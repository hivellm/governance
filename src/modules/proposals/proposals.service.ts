import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { 
  IProposal, 
  ProposalStatus, 
  GovernancePhase, 
  ProposalType,
  CreateProposalRequest,
  UpdateProposalRequest,
  ProposalListOptions,
  ProposalVotingResult
} from './interfaces/proposal.interface';
import { CreateProposalDto, UpdateProposalDto, ListProposalsDto } from './dto';

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Generate next sequential proposal ID in format P001, P002, etc.
   */
  private async generateNextProposalId(): Promise<string> {
    try {
      // Get the highest existing P### ID
      const maxIdStatement = this.databaseService.getStatement('getMaxProposalId');
      const result = maxIdStatement.get() as { max_id: string | null };
      
      let nextNumber = 1;
      if (result?.max_id) {
        // Extract number from P### format
        const match = result.max_id.match(/^P(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      
      return `P${nextNumber.toString().padStart(3, '0')}`;
    } catch (error) {
      this.logger.warn(`Failed to generate sequential ID, using fallback: ${error.message}`);
      // Fallback to timestamp-based ID
      const timestamp = Date.now();
      return `P${timestamp.toString().slice(-3)}`;
    }
  }

  /**
   * Create a new proposal
   */
  async createProposal(authorId: string, createProposalDto: CreateProposalDto): Promise<IProposal> {
    this.logger.debug(`Creating new proposal by agent: ${authorId}`);

    // Use provided ID when available to avoid duplicates; fallback to sequential ID
    const providedId = (createProposalDto as any).id as string | undefined;
    const proposalId = providedId && providedId.trim().length > 0 ? providedId.trim() : await this.generateNextProposalId();

    // Check if a proposal with the same ID already exists
    try {
      const existing = await this.findById(proposalId);
      if (existing) {
        this.logger.log(`⚠️ Proposal already exists with id ${proposalId}. Returning existing.`);
        return existing;
      }
    } catch (_) {
      // not found -> proceed to create
    }

    const proposal: IProposal = {
      id: proposalId,
      title: createProposalDto.title,
      authorId,
      status: ProposalStatus.DRAFT,
      phase: GovernancePhase.PROPOSAL,
      type: createProposalDto.type,
      content: createProposalDto.content,
      metadata: {
        ...createProposalDto.metadata,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const insertStatement = this.databaseService.getDatabase().prepare(`
        INSERT INTO proposals (id, title, author_id, status, phase, type, content, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          metadata = excluded.metadata,
          updated_at = CURRENT_TIMESTAMP
      `);
      insertStatement.run(
        proposal.id,
        proposal.title,
        proposal.authorId,
        proposal.status,
        proposal.phase,
        proposal.type,
        JSON.stringify(proposal.content),
        JSON.stringify(proposal.metadata)
      );

      this.logger.log(`✅ Proposal created: ${proposal.id} - "${proposal.title}"`);
      return proposal;
    } catch (error) {
      this.logger.error(`❌ Failed to create proposal: ${error.message}`);
      throw new BadRequestException('Failed to create proposal');
    }
  }

  /**
   * Get proposal by ID
   */
  async findById(id: string): Promise<IProposal> {
    this.logger.debug(`Finding proposal: ${id}`);

    try {
      const getStatement = this.databaseService.getStatement('getProposal');
      const row = getStatement.get(id);

      if (!row) {
        throw new NotFoundException(`Proposal not found: ${id}`);
      }

      return this.mapRowToProposal(row);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`❌ Failed to find proposal ${id}: ${error.message}`);
      throw new BadRequestException('Failed to retrieve proposal');
    }
  }

  /**
   * List proposals with filtering and pagination
   */
  async findAll(listProposalsDto: ListProposalsDto): Promise<{ items: IProposal[]; total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean }> {
    this.logger.debug('Listing proposals with filters', listProposalsDto);

    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = listProposalsDto;
    const offset = (page - 1) * limit;

    // Build dynamic query
    let query = 'SELECT * FROM proposals';
    let countQuery = 'SELECT COUNT(*) as total FROM proposals';
    const conditions: string[] = [];
    const params: any[] = [];

    // Apply filters
    if (listProposalsDto.status?.length) {
      const placeholders = listProposalsDto.status.map(() => '?').join(',');
      conditions.push(`status IN (${placeholders})`);
      params.push(...listProposalsDto.status);
    }

    if (listProposalsDto.phase?.length) {
      const placeholders = listProposalsDto.phase.map(() => '?').join(',');
      conditions.push(`phase IN (${placeholders})`);
      params.push(...listProposalsDto.phase);
    }

    if (listProposalsDto.type?.length) {
      const placeholders = listProposalsDto.type.map(() => '?').join(',');
      conditions.push(`type IN (${placeholders})`);
      params.push(...listProposalsDto.type);
    }

    if (listProposalsDto.author) {
      conditions.push('author_id = ?');
      params.push(listProposalsDto.author);
    }

    if (listProposalsDto.dateFrom) {
      conditions.push('created_at >= ?');
      params.push(listProposalsDto.dateFrom);
    }

    if (listProposalsDto.dateTo) {
      conditions.push('created_at <= ?');
      params.push(listProposalsDto.dateTo);
    }

    // Apply search text using FTS
    if (listProposalsDto.searchText) {
      query = `
        SELECT p.* FROM proposals p
        INNER JOIN proposals_fts fts ON p.id = fts.id
        WHERE fts MATCH ?
      `;
      countQuery = `
        SELECT COUNT(*) as total FROM proposals p
        INNER JOIN proposals_fts fts ON p.id = fts.id
        WHERE fts MATCH ?
      `;
      params.unshift(listProposalsDto.searchText);
    }

    // Add WHERE clause if conditions exist
    if (conditions.length > 0 && !listProposalsDto.searchText) {
      const whereClause = ` WHERE ${conditions.join(' AND ')}`;
      query += whereClause;
      countQuery += whereClause;
    } else if (conditions.length > 0 && listProposalsDto.searchText) {
      query += ` AND ${conditions.join(' AND ')}`;
      countQuery += ` AND ${conditions.join(' AND ')}`;
    }

    // Add sorting and pagination
    query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      // Get total count
      const countStatement = this.databaseService.getDatabase().prepare(countQuery);
      const countResult = countStatement.get(...(listProposalsDto.searchText ? [listProposalsDto.searchText, ...params.slice(1, -2)] : params.slice(0, -2))) as { total: number };
      const total = countResult.total;

      // Get paginated results
      const listStatement = this.databaseService.getDatabase().prepare(query);
      const rows = listStatement.all(...params);

      const items = rows.map(row => this.mapRowToProposal(row));
      const totalPages = Math.ceil(total / limit);

      const result = {
        items,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      this.logger.debug(`✅ Listed ${items.length} proposals (${total} total)`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Failed to list proposals: ${error.message}`);
      throw new BadRequestException('Failed to list proposals');
    }
  }

  /**
   * Update proposal
   */
  async updateProposal(id: string, updateProposalDto: UpdateProposalDto): Promise<IProposal> {
    this.logger.debug(`Updating proposal: ${id}`);

    // First check if proposal exists and get current state
    const existingProposal = await this.findById(id);

    // Validate that proposal can be updated
    if (existingProposal.status !== ProposalStatus.DRAFT && existingProposal.status !== ProposalStatus.REVISION) {
      throw new BadRequestException(`Proposal cannot be updated in ${existingProposal.status} status`);
    }

    try {
      // Update only provided fields
      const updatedProposal: IProposal = {
        ...existingProposal,
        ...updateProposalDto,
        content: updateProposalDto.content ? { ...existingProposal.content, ...updateProposalDto.content } : existingProposal.content,
        metadata: updateProposalDto.metadata ? { ...existingProposal.metadata, ...updateProposalDto.metadata, updated_date: new Date().toISOString() } : { ...existingProposal.metadata, updated_date: new Date().toISOString() },
        updatedAt: new Date(),
      };

      // Update database
      const updateQuery = `
        UPDATE proposals 
        SET title = ?, content = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      const updateStatement = this.databaseService.getDatabase().prepare(updateQuery);
      updateStatement.run(
        updatedProposal.title,
        JSON.stringify(updatedProposal.content),
        JSON.stringify(updatedProposal.metadata),
        id
      );

      this.logger.log(`✅ Proposal updated: ${id} - "${updatedProposal.title}"`);
      return updatedProposal;
    } catch (error) {
      this.logger.error(`❌ Failed to update proposal ${id}: ${error.message}`);
      throw new BadRequestException('Failed to update proposal');
    }
  }

  /**
   * Delete proposal (only drafts can be deleted)
   */
  async deleteProposal(id: string): Promise<void> {
    this.logger.debug(`Deleting proposal: ${id}`);

    const existingProposal = await this.findById(id);

    if (existingProposal.status !== ProposalStatus.DRAFT) {
      throw new BadRequestException('Only draft proposals can be deleted');
    }

    try {
      const deleteQuery = 'DELETE FROM proposals WHERE id = ?';
      const deleteStatement = this.databaseService.getDatabase().prepare(deleteQuery);
      const result = deleteStatement.run(id);

      if (result.changes === 0) {
        throw new NotFoundException(`Proposal not found: ${id}`);
      }

      this.logger.log(`✅ Proposal deleted: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`❌ Failed to delete proposal ${id}: ${error.message}`);
      throw new BadRequestException('Failed to delete proposal');
    }
  }

  /**
   * Submit proposal for discussion (status transition)
   */
  async submitForDiscussion(id: string): Promise<IProposal> {
    this.logger.debug(`Submitting proposal for discussion: ${id}`);

    const proposal = await this.findById(id);

    if (proposal.status !== ProposalStatus.DRAFT) {
      throw new BadRequestException(`Proposal must be in draft status to submit for discussion. Current status: ${proposal.status}`);
    }

    return this.updateProposalStatus(id, ProposalStatus.DISCUSSION, GovernancePhase.DISCUSSION);
  }

  /**
   * Move proposal to revision phase
   */
  async moveToRevision(id: string): Promise<IProposal> {
    this.logger.debug(`Moving proposal to revision: ${id}`);

    const proposal = await this.findById(id);

    if (proposal.status !== ProposalStatus.DISCUSSION) {
      throw new BadRequestException(`Proposal must be in discussion status to move to revision. Current status: ${proposal.status}`);
    }

    return this.updateProposalStatus(id, ProposalStatus.REVISION, GovernancePhase.REVISION);
  }

  /**
   * Move proposal to voting phase
   */
  async moveToVoting(id: string, votingDeadline: Date): Promise<IProposal> {
    this.logger.debug(`Moving proposal to voting: ${id}`);

    const proposal = await this.findById(id);

    if (proposal.status !== ProposalStatus.REVISION && proposal.status !== ProposalStatus.DISCUSSION) {
      throw new BadRequestException(`Proposal cannot move to voting from ${proposal.status} status`);
    }

    try {
      const updateQuery = `
        UPDATE proposals 
        SET status = ?, phase = ?, voting_deadline = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      const updateStatement = this.databaseService.getDatabase().prepare(updateQuery);
      updateStatement.run(ProposalStatus.VOTING, GovernancePhase.VOTING, votingDeadline.toISOString(), id);

      const updatedProposal = await this.findById(id);
      this.logger.log(`✅ Proposal moved to voting: ${id} (deadline: ${votingDeadline.toISOString()})`);
      return updatedProposal;
    } catch (error) {
      this.logger.error(`❌ Failed to move proposal to voting ${id}: ${error.message}`);
      throw new BadRequestException('Failed to move proposal to voting');
    }
  }

  /**
   * Get voting results for a proposal
   */
  async getVotingResults(id: string): Promise<ProposalVotingResult> {
    this.logger.debug(`Getting voting results for proposal: ${id}`);

    try {
      const votesQuery = `
        SELECT 
          decision,
          COUNT(*) as count,
          SUM(weight) as total_weight
        FROM votes 
        WHERE proposal_id = ? 
        GROUP BY decision
      `;
      const votesStatement = this.databaseService.getDatabase().prepare(votesQuery);
      const voteResults = votesStatement.all(id) as Array<{ decision: string; count: number; total_weight: number }>;

      let approveVotes = 0;
      let rejectVotes = 0;
      let abstainVotes = 0;
      let totalWeight = 0;

      voteResults.forEach(result => {
        switch (result.decision) {
          case 'approve':
            approveVotes = result.count;
            totalWeight += result.total_weight || result.count;
            break;
          case 'reject':
            rejectVotes = result.count;
            totalWeight += result.total_weight || result.count;
            break;
          case 'abstain':
            abstainVotes = result.count;
            break;
        }
      });

      const totalVotes = approveVotes + rejectVotes + abstainVotes;
      const consensusPercentage = totalVotes > 0 ? (approveVotes / (approveVotes + rejectVotes)) * 100 : 0;
      const quorumMet = totalVotes >= 3; // Configurable threshold

      // Determine result based on consensus threshold (67%)
      let result: 'approved' | 'rejected' | 'pending' = 'pending';
      if (quorumMet && consensusPercentage >= 67) {
        result = 'approved';
      } else if (quorumMet && consensusPercentage < 67) {
        result = 'rejected';
      }

      const votingResult: ProposalVotingResult = {
        proposalId: id,
        totalVotes,
        approveVotes,
        rejectVotes,
        abstainVotes,
        consensusPercentage: Math.round(consensusPercentage * 100) / 100,
        quorumMet,
        result,
        votingClosed: result !== 'pending',
      };

      this.logger.debug(`✅ Voting results calculated for ${id}: ${JSON.stringify(votingResult)}`);
      return votingResult;
    } catch (error) {
      this.logger.error(`❌ Failed to get voting results ${id}: ${error.message}`);
      throw new BadRequestException('Failed to get voting results');
    }
  }

  /**
   * Finalize proposal voting and update status
   */
  async finalizeVoting(id: string): Promise<IProposal> {
    this.logger.debug(`Finalizing voting for proposal: ${id}`);

    const votingResult = await this.getVotingResults(id);

    if (votingResult.result === 'pending') {
      throw new BadRequestException('Cannot finalize voting: insufficient votes or quorum not met');
    }

    const newStatus = votingResult.result === 'approved' ? ProposalStatus.APPROVED : ProposalStatus.REJECTED;
    const newPhase = votingResult.result === 'approved' ? GovernancePhase.RESOLUTION : GovernancePhase.RESOLUTION;

    const finalizedProposal = await this.updateProposalStatus(id, newStatus, newPhase);

    this.logger.log(`✅ Voting finalized for proposal ${id}: ${votingResult.result.toUpperCase()}`);
    return finalizedProposal;
  }

  /**
   * Mark proposal as executed
   */
  async markAsExecuted(id: string, executionData?: any): Promise<IProposal> {
    this.logger.debug(`Marking proposal as executed: ${id}`);

    const proposal = await this.findById(id);

    if (proposal.status !== ProposalStatus.APPROVED) {
      throw new BadRequestException(`Proposal must be approved before execution. Current status: ${proposal.status}`);
    }

    try {
      const updateQuery = `
        UPDATE proposals 
        SET status = ?, phase = ?, execution_data = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      const updateStatement = this.databaseService.getDatabase().prepare(updateQuery);
      updateStatement.run(
        ProposalStatus.EXECUTED,
        GovernancePhase.EXECUTION,
        executionData ? JSON.stringify(executionData) : null,
        id
      );

      const executedProposal = await this.findById(id);
      this.logger.log(`✅ Proposal marked as executed: ${id}`);
      return executedProposal;
    } catch (error) {
      this.logger.error(`❌ Failed to mark proposal as executed ${id}: ${error.message}`);
      throw new BadRequestException('Failed to mark proposal as executed');
    }
  }

  /**
   * Search proposals using full-text search
   */
  async searchProposals(searchText: string, limit: number = 20): Promise<IProposal[]> {
    this.logger.debug(`Searching proposals: "${searchText}"`);

    try {
      const searchQuery = `
        SELECT p.* FROM proposals p
        INNER JOIN proposals_fts fts ON p.id = fts.id
        WHERE fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `;
      const searchStatement = this.databaseService.getDatabase().prepare(searchQuery);
      const rows = searchStatement.all(searchText, limit);

      const proposals = rows.map(row => this.mapRowToProposal(row));

      this.logger.debug(`✅ Found ${proposals.length} proposals matching "${searchText}"`);
      return proposals;
    } catch (error) {
      this.logger.error(`❌ Failed to search proposals: ${error.message}`);
      throw new BadRequestException('Failed to search proposals');
    }
  }

  /**
   * Get statistics for dashboard
   */
  async getProposalStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byPhase: Record<string, number>;
    recent: number;
  }> {
    this.logger.debug('Getting proposal statistics');

    try {
      // Total count
      const totalQuery = 'SELECT COUNT(*) as total FROM proposals';
      const totalResult = this.databaseService.getDatabase().prepare(totalQuery).get() as { total: number };

      // By status
      const statusQuery = 'SELECT status, COUNT(*) as count FROM proposals GROUP BY status';
      const statusResults = this.databaseService.getDatabase().prepare(statusQuery).all() as Array<{ status: string; count: number }>;

      // By type  
      const typeQuery = 'SELECT type, COUNT(*) as count FROM proposals GROUP BY type';
      const typeResults = this.databaseService.getDatabase().prepare(typeQuery).all() as Array<{ type: string; count: number }>;

      // By phase
      const phaseQuery = 'SELECT phase, COUNT(*) as count FROM proposals GROUP BY phase';
      const phaseResults = this.databaseService.getDatabase().prepare(phaseQuery).all() as Array<{ phase: string; count: number }>;

      // Recent (last 7 days)
      const recentQuery = `
        SELECT COUNT(*) as recent 
        FROM proposals 
        WHERE created_at >= datetime('now', '-7 days')
      `;
      const recentResult = this.databaseService.getDatabase().prepare(recentQuery).get() as { recent: number };

      const statistics = {
        total: totalResult.total,
        byStatus: statusResults.reduce((acc, curr) => ({ ...acc, [curr.status]: curr.count }), {}),
        byType: typeResults.reduce((acc, curr) => ({ ...acc, [curr.type]: curr.count }), {}),
        byPhase: phaseResults.reduce((acc, curr) => ({ ...acc, [curr.phase]: curr.count }), {}),
        recent: recentResult.recent,
      };

      this.logger.debug(`✅ Proposal statistics calculated: ${JSON.stringify(statistics)}`);
      return statistics;
    } catch (error) {
      this.logger.error(`❌ Failed to get proposal statistics: ${error.message}`);
      throw new BadRequestException('Failed to get proposal statistics');
    }
  }

  // Private helper methods
  
  private async updateProposalStatus(id: string, status: ProposalStatus, phase: GovernancePhase): Promise<IProposal> {
    try {
      const updateStatement = this.databaseService.getStatement('updateProposalStatus');
      updateStatement.run(status, phase, id);

      const updatedProposal = await this.findById(id);
      this.logger.log(`✅ Proposal status updated: ${id} -> ${status} (${phase})`);
      return updatedProposal;
    } catch (error) {
      this.logger.error(`❌ Failed to update proposal status ${id}: ${error.message}`);
      throw new BadRequestException('Failed to update proposal status');
    }
  }

  private mapRowToProposal(row: any): IProposal {
    return {
      id: row.id,
      title: row.title,
      authorId: row.author_id,
      status: row.status,
      phase: row.phase,
      type: row.type,
      content: JSON.parse(row.content),
      metadata: JSON.parse(row.metadata),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      votingDeadline: row.voting_deadline ? new Date(row.voting_deadline) : undefined,
      executionData: row.execution_data ? JSON.parse(row.execution_data) : undefined,
    };
  }

  /**
   * Update proposal status - used by voting system (public method)
   */
  async updateProposalStatusPublic(id: string, newStatus: string): Promise<IProposal> {
    this.logger.log(`Updating proposal status: ${id} -> ${newStatus}`);

    // Map string status to enum
    let mappedStatus: ProposalStatus;
    let mappedPhase: GovernancePhase;

    switch (newStatus) {
      case 'approved':
        mappedStatus = ProposalStatus.APPROVED;
        mappedPhase = GovernancePhase.RESOLUTION;
        break;
      case 'rejected':
        mappedStatus = ProposalStatus.REJECTED;
        mappedPhase = GovernancePhase.RESOLUTION;
        break;
      case 'executed':
        mappedStatus = ProposalStatus.EXECUTED;
        mappedPhase = GovernancePhase.EXECUTION;
        break;
      default:
        throw new Error(`Invalid status: ${newStatus}`);
    }

    return this.updateProposalStatus(id, mappedStatus, mappedPhase);
  }

  /**
   * Advance proposal to discussion phase
   */
  async advanceToDiscussion(proposalId: string, agentId: string): Promise<IProposal> {
    this.logger.debug(`Advancing proposal ${proposalId} to discussion phase`);
    
    const proposal = await this.findById(proposalId);
    
    if (proposal.phase !== GovernancePhase.PROPOSAL) {
      throw new BadRequestException(`Proposal must be in ${GovernancePhase.PROPOSAL} phase to advance to discussion`);
    }

    if (proposal.status !== ProposalStatus.DRAFT) {
      throw new BadRequestException(`Proposal must be in ${ProposalStatus.DRAFT} status to advance to discussion`);
    }

    // Update proposal to discussion phase
    const updatedProposal = await this.updateProposalStatus(
      proposalId, 
      ProposalStatus.DISCUSSION, 
      GovernancePhase.DISCUSSION
    );

    // Set discussion deadline (48 hours by default)
    const discussionDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const db = this.databaseService.getDatabase();
    db.prepare(`
      UPDATE proposals 
      SET voting_deadline = ?
      WHERE id = ?
    `).run(discussionDeadline.toISOString(), proposalId);

    this.logger.log(`✅ Proposal ${proposalId} advanced to discussion phase`);
    return updatedProposal;
  }

  /**
   * Advance proposal to voting phase
   */
  async advanceToVoting(proposalId: string, agentId: string): Promise<IProposal> {
    this.logger.debug(`Advancing proposal ${proposalId} to voting phase`);
    
    const proposal = await this.findById(proposalId);
    
    if (![GovernancePhase.DISCUSSION, GovernancePhase.REVISION].includes(proposal.phase)) {
      throw new BadRequestException(`Proposal must be in discussion or revision phase to advance to voting`);
    }

    // Update proposal to voting phase
    const updatedProposal = await this.updateProposalStatus(
      proposalId, 
      ProposalStatus.VOTING, 
      GovernancePhase.VOTING
    );

    // Set voting deadline (72 hours by default)
    const votingDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const db = this.databaseService.getDatabase();
    db.prepare(`
      UPDATE proposals 
      SET voting_deadline = ?
      WHERE id = ?
    `).run(votingDeadline.toISOString(), proposalId);

    this.logger.log(`✅ Proposal ${proposalId} advanced to voting phase`);
    return updatedProposal;
  }

  /**
   * Finalize proposal based on voting results
   */
  async finalizeProposal(proposalId: string, agentId: string): Promise<IProposal> {
    this.logger.debug(`Finalizing proposal ${proposalId}`);
    
    const proposal = await this.findById(proposalId);
    
    if (proposal.phase !== GovernancePhase.VOTING) {
      throw new BadRequestException(`Proposal must be in voting phase to finalize`);
    }

    // Get voting results
    const votingResult = await this.getVotingResults(proposalId);
    
    // Determine final status based on voting results
    const finalStatus = votingResult.result === 'approved' ? 
      ProposalStatus.APPROVED : ProposalStatus.REJECTED;
    
    const finalPhase = finalStatus === ProposalStatus.APPROVED ? 
      GovernancePhase.EXECUTION : GovernancePhase.RESOLUTION;

    // Update proposal status
    const updatedProposal = await this.updateProposalStatus(
      proposalId, 
      finalStatus, 
      finalPhase
    );

    this.logger.log(`✅ Proposal ${proposalId} finalized with status: ${finalStatus}`);
    return updatedProposal;
  }

  /**
   * Check if proposal can advance to next phase
   */
  async canAdvancePhase(proposalId: string, targetPhase: GovernancePhase): Promise<{
    canAdvance: boolean;
    reasons: string[];
  }> {
    const proposal = await this.findById(proposalId);
    const reasons: string[] = [];

    switch (targetPhase) {
      case GovernancePhase.DISCUSSION:
        if (proposal.phase !== GovernancePhase.PROPOSAL) {
          reasons.push(`Proposal must be in ${GovernancePhase.PROPOSAL} phase`);
        }
        if (proposal.status !== ProposalStatus.DRAFT) {
          reasons.push(`Proposal must be in ${ProposalStatus.DRAFT} status`);
        }
        break;

      case GovernancePhase.VOTING:
        if (![GovernancePhase.DISCUSSION, GovernancePhase.REVISION].includes(proposal.phase)) {
          reasons.push('Proposal must be in discussion or revision phase');
        }
        // Could add additional checks like minimum discussion time, participation, etc.
        break;

      case GovernancePhase.EXECUTION:
        if (proposal.phase !== GovernancePhase.VOTING) {
          reasons.push('Proposal must be in voting phase');
        }
        if (proposal.status !== ProposalStatus.APPROVED) {
          reasons.push('Proposal must be approved to execute');
        }
        break;

      default:
        reasons.push(`Unsupported target phase: ${targetPhase}`);
    }

    return {
      canAdvance: reasons.length === 0,
      reasons
    };
  }
}
