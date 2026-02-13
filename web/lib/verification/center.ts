import type { VerificationStatus } from "@/lib/verification/status";
import type { VerificationRequirements } from "@/lib/trust-markers";

export type VerificationStepKey = "email" | "phone" | "bank";

export type VerificationStepState = {
  key: VerificationStepKey;
  verified: boolean;
  required: boolean;
  statusLabel: "Verified" | "Not verified" | "Coming soon" | "Not required right now";
};

export type VerificationCenterState = {
  completion: {
    requiredCompleted: number;
    requiredTotal: number;
    isComplete: boolean;
  };
  steps: Record<VerificationStepKey, VerificationStepState>;
};

function isStepRequired(key: VerificationStepKey, requirements: VerificationRequirements) {
  if (key === "email") return requirements.requireEmail;
  if (key === "phone") return requirements.requirePhone;
  return requirements.requireBank;
}

function getStatusLabel(input: {
  key: VerificationStepKey;
  verified: boolean;
  required: boolean;
}): VerificationStepState["statusLabel"] {
  if (input.verified) return "Verified";
  if (input.key === "bank" && input.required) return "Coming soon";
  if (!input.required) return "Not required right now";
  return "Not verified";
}

export function isVerificationCompleteForRequirements(
  status: Pick<VerificationStatus, "email" | "phone" | "bank">,
  requirements: VerificationRequirements
): boolean {
  const checks: Array<{ required: boolean; verified: boolean }> = [
    { required: requirements.requireEmail, verified: status.email.verified === true },
    { required: requirements.requirePhone, verified: status.phone.verified === true },
    { required: requirements.requireBank, verified: status.bank.verified === true },
  ];
  const requiredChecks = checks.filter((check) => check.required);
  if (!requiredChecks.length) return false;
  return requiredChecks.every((check) => check.verified);
}

export function buildVerificationCenterState(input: {
  status: Pick<VerificationStatus, "email" | "phone" | "bank">;
  requirements: VerificationRequirements;
}): VerificationCenterState {
  const steps = (["email", "phone", "bank"] as const).reduce<
    VerificationCenterState["steps"]
  >((acc, key) => {
    const required = isStepRequired(key, input.requirements);
    const verified = input.status[key].verified === true;
    acc[key] = {
      key,
      verified,
      required,
      statusLabel: getStatusLabel({
        key,
        verified,
        required,
      }),
    };
    return acc;
  }, {} as VerificationCenterState["steps"]);

  const requiredSteps = Object.values(steps).filter((step) => step.required);
  const requiredCompleted = requiredSteps.filter((step) => step.verified).length;
  const requiredTotal = requiredSteps.length;

  return {
    completion: {
      requiredCompleted,
      requiredTotal,
      isComplete: requiredTotal > 0 && requiredCompleted >= requiredTotal,
    },
    steps,
  };
}
