import { z } from "zod";

export const SETUP_HARNESSES = [
  "hermes",
  "openclaw",
  "codex",
  "claude-code",
] as const;
export type SetupHarness = (typeof SETUP_HARNESSES)[number];
export type AgentEnvironment = {
  readonly id: string;
  readonly kind: "linux" | "windows" | "wsl" | "macos";
  readonly label: string;
  readonly distro?: string | undefined;
};
export type NativeIdentity = {
  readonly id: string;
  readonly label: string;
  readonly kind: "profile" | "agent";
  readonly profilePath: string;
};
export type AgentInstallation = {
  readonly id: string;
  readonly adapterId: SetupHarness;
  readonly environment: AgentEnvironment;
  readonly executablePath: string;
  readonly canonicalExecutablePath?: string;
  readonly homePath: string;
  readonly identities: readonly NativeIdentity[];
  /** Finding an executable is not authentication or execution proof. */
  readonly status: "found";
};

export type DiscoveryResult = {
  readonly defaultWslDistro?: string;
  readonly currentWslDistro?: string;
  readonly installations: readonly AgentInstallation[];
  readonly environments: readonly {
    readonly id: string;
    readonly label: string;
    readonly status: "scanned" | "stopped" | "unavailable";
    readonly message?: string;
  }[];
};
export const RegistrationSchema = z.object({
  id: z.string().uuid(),
  adapterId: z.enum(["hermes", "openclaw", "codex", "claude-code"]),
  displayName: z.string().trim().min(1).max(80),
  installationId: z.string().min(1).max(128),
  environment: z.object({
    id: z.string(),
    kind: z.enum(["linux", "macos", "windows", "wsl"]),
    label: z.string(),
    distro: z.string().optional(),
  }),
  executablePath: z.string().min(1).max(4096),
  homePath: z.string().min(1).max(4096),
  identity: z.object({
    id: z.string(),
    label: z.string(),
    kind: z.enum(["profile", "agent"]),
    profilePath: z.string(),
  }),
  connectedAt: z.string().datetime(),
  conversationRef: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/)
    .optional(),
});
export type AgentRegistration = z.infer<typeof RegistrationSchema>;
export const SetupStateSchema = z.object({
  schema: z.literal("aiw.agent-setup/1"),
  completed: z.boolean(),
  registrations: z.array(RegistrationSchema).max(64),
});
export type AgentSetupState = z.infer<typeof SetupStateSchema>;

export type SetupCheck = {
  readonly status: "ready" | "needs-attention";
  readonly message: string;
};
export const AttachAgentInputSchema = z
  .object({
    installationId: z.string().min(1).max(128),
    identityId: z.string().min(1).max(80),
    displayName: z.string().trim().min(1).max(80),
    conversationRef: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/)
      .optional(),
  })
  .strict();
export type SetupSelection = z.infer<typeof AttachAgentInputSchema>;
export type PrerequisitePlan = {
  id: string;
  expiresAt: string;
  target: string;
  actions: {
    id: string;
    kind: "enable-hermes-world-plugin";
    title: string;
    reason: string;
    effect: string;
    paths: string[];
  }[];
  guidance: string[];
};

export type SetupConversation = {
  readonly id: string;
  readonly title: string;
  readonly source: string;
};
