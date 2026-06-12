export type Role = 'master_admin' | 'teacher_admin' | 'student_admin' | 'teacher' | 'student';

export type ElectionStatus = 'draft' | 'active' | 'ended';

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  email_verified: number;
  id_verified: number;
  id_image: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface Election {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: ElectionStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: number;
  election_id: number;
  name: string;
  max_votes: number;
  order_index: number;
}

export interface Candidate {
  id: number;
  election_id: number;
  position_id: number;
  name: string;
  bio: string | null;
  image: string | null;
}

export interface Vote {
  id: number;
  election_id: number;
  position_id: number;
  candidate_id: number;
  voter_id: number;
  created_at: string;
}

export interface VerificationRequest {
  id: number;
  user_id: number;
  image_path: string;
  status: VerificationStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  user?: User;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface ElectionWithPositions extends Election {
  positions: (Position & { candidates: Candidate[] })[];
}

export interface CandidateWithVotes extends Candidate {
  vote_count: number;
}

export interface PositionWithResults extends Position {
  candidates: CandidateWithVotes[];
}
