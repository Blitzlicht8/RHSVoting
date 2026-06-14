export type Role = 'master_admin' | 'admin' | 'moderator' | 'staff' | 'member' | string;

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
  grade_level_id?: number | null;
  subtype_id?: number | null;
  section_id?: number | null;
  avatar_url?: string | null;
  bio?: string | null;
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
  allow_teacher_vote?: 0 | 1;
  is_global?: 0 | 1;
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
  photo_url?: string | null;
  platform?: string | null;
  qualifications?: string | null;
  user_id?: number | null;
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
  grade_level_id?: number | null;
  subtype_id?: number | null;
  section_id?: number | null;
  doc_type?: string | null;
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

export interface GradeLevel {
  id: number;
  name: string;
  order_index: number;
  active: 0 | 1;
  created_at: string;
}

export interface GradeSubtype {
  id: number;
  grade_level_id: number;
  name: string;
  order_index: number;
  active: 0 | 1;
}

export interface Section {
  id: number;
  grade_level_id: number;
  subtype_id: number | null;
  name: string;
  order_index: number;
  active: 0 | 1;
}

export interface Post {
  id: number;
  author_id: number;
  election_id: number | null;
  content: string;
  is_public: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface PostMedia {
  id: number;
  post_id: number;
  type: string;
  url: string;
  order_index: number;
}

export interface PostReaction {
  id: number;
  post_id: number;
  user_id: number;
  type: string;
  created_at: string;
}

export interface PostComment {
  id: number;
  post_id: number;
  author_id: number;
  content: string;
  created_at: string;
}

export interface PostReport {
  id: number;
  post_id: number;
  reporter_id: number;
  reason: string | null;
  status: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface UserAchievement {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  year: number | null;
  order_index: number;
}

export interface AppRole {
  id: number;
  name: string;
  is_system: 0 | 1;
  permissions: Record<string, boolean>;
  created_at: string;
}

export interface NameHistory {
  id: number;
  user_id: number;
  old_name: string;
  new_name: string;
  changed_at: string;
}

export interface CommentReport {
  id: number;
  comment_id: number;
  reporter_id: number;
  reason: string | null;
  status: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AppSettings {
  auto_verify_id: string;
  otp_required_login: string;
  app_name: string;
  group_label_l1: string;
  group_label_l2: string;
  group_label_l3: string;
  doc_type_labels: string;
  org_type: string;
}
