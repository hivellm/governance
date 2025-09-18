export enum VoteDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
  ABSTAIN = 'abstain'
}

export interface VotingRule {
  type: string;
  value: any;
}

export interface AutomatedVotingConfig {
  duration: number; // hours
  quorumThreshold: number; // 0-1
  consensusThreshold: number; // 0-1
  autoFinalize: boolean;
  allowedRoles: string[];
  votingRules: VotingRule[];
  timeoutBehavior: 'extend_once' | 'finalize_immediately' | 'reject_proposal';
}

export interface VotingSession {
  id: string;
  proposalId: string;
  status: 'active' | 'finalized' | 'cancelled';
  config: AutomatedVotingConfig;
  startedAt: Date;
  deadline: Date;
  eligibleAgents: string[];
  votes: VoteCast[];
  results: VotingResults | null;
  finalizedAt?: Date;
}

export interface VoteCast {
  id: string;
  sessionId: string;
  agentId: string;
  decision: VoteDecision;
  justification: string;
  weight: number;
  castAt: Date;
  metadata?: any;
}

export interface VotingResults {
  sessionId: string;
  proposalId: string;
  status: string;
  totalEligible: number;
  totalVotes: number;
  participationRate: number;
  quorumMet: boolean;
  quorumThreshold: number;
  votes: {
    approve: { count: number; weight: number };
    reject: { count: number; weight: number };
    abstain: { count: number; weight: number };
  };
  consensus: {
    percentage: number;
    threshold: number;
    met: boolean;
  };
  result: 'approved' | 'rejected' | 'pending';
  deadline: Date;
  timeRemaining: number;
  finalizedAt: Date | null;
}

export type ConsensusLevel = 'simple' | 'majority' | 'supermajority' | 'unanimous';
