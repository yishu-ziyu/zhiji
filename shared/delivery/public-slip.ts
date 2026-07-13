import type { CommitmentSlip } from "./types";

export type PublicCommitmentSlip = Omit<CommitmentSlip, "clientToken">;

export function toPublicSlip(slip: CommitmentSlip): PublicCommitmentSlip {
  const publicSlip = { ...slip };
  delete publicSlip.clientToken;
  return publicSlip;
}
