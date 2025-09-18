export interface IProposal {
  id: string;
  title: string;
  authorId: string;
  status: ProposalStatus;
  phase: GovernancePhase;
  type: ProposalType;
  content: ProposalContent;
  metadata: ProposalMetadata;
  createdAt: Date;
  updatedAt: Date;
  votingDeadline?: Date;
  executionData?: any;
}

export enum ProposalStatus {
  DRAFT = 'draft',
  DISCUSSION = 'discussion', 
  REVISION = 'revision',
  VOTING = 'voting',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXECUTED = 'executed',
}

export enum GovernancePhase {
  PROPOSAL = 'proposal',
  DISCUSSION = 'discussion',
  REVISION = 'revision', 
  VOTING = 'voting',
  RESOLUTION = 'resolution',
  EXECUTION = 'execution',
}

export enum ProposalType {
  STANDARDS = 'standards',
  INFORMATIONAL = 'informational',
  PROCESS = 'process',
}

export interface ProposalContent {
  abstract: string;
  motivation: string;
  specification: string;
  implementation?: string;
  rationale?: string;
  backwards_compatibility?: string;
  reference_implementation?: string;
  security_considerations?: string;
  copyright?: string;
}

export interface ProposalMetadata {
  dependencies?: string[];
  replaces?: string[];
  superseded_by?: string[];
  category?: string[];
  discussions_to?: string;
  author_github?: string;
  author_email?: string;
  requires?: string[];
  resolution?: string;
  created_date?: string;
  updated_date?: string;
  post_history?: string[];
}

export interface ProposalVotingResult {
  proposalId: string;
  totalVotes: number;
  approveVotes: number;
  rejectVotes: number;
  abstainVotes: number;
  consensusPercentage: number;
  quorumMet: boolean;
  result: 'approved' | 'rejected' | 'pending';
  votingClosed: boolean;
}

export interface CreateProposalRequest {
  title: string;
  type: ProposalType;
  content: ProposalContent;
  metadata?: Partial<ProposalMetadata>;
}

export interface UpdateProposalRequest {
  title?: string;
  content?: Partial<ProposalContent>;
  metadata?: Partial<ProposalMetadata>;
}

export interface ProposalSearchFilters {
  status?: ProposalStatus[];
  phase?: GovernancePhase[];
  type?: ProposalType[];
  author?: string;
  dateFrom?: Date;
  dateTo?: Date;
  searchText?: string;
}

export interface ProposalListOptions {
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'updated_at' | 'title' | 'status';
  sortOrder?: 'asc' | 'desc';
  filters?: ProposalSearchFilters;
}
