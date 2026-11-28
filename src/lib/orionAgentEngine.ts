import { supabase } from './supabase';
import {
  OrionAction,
  OrionActionType,
  OrionExecutionResult,
  OrionStructuredCard,
  OrionUserContext,
  StructuredOrionPayload,
  executeOrionActionPipeline,
  isConsequentialAction,
  validateActionPermission,
  validateOrionActionParameters,
} from './orionActionExecutor';

export type OrionProgressPhase =
  | 'analyzing'
  | 'planning'
  | 'clarifying'
  | 'preparing'
  | 'executing'
  | 'verifying'
  | 'awaiting_confirmation'
  | 'completed'
  | 'failed';

export interface OrionPlanStep {
  id: string;
  label: string;
  action: OrionActionType;
  status: 'pending' | 'running' | 'completed' | 'verified' | 'failed' | 'blocked';
  detail?: string;
  durationMs?: number;
  verificationNote?: string;
  recordId?: string;
}

export interface OrionStageEntry {
  phase: OrionProgressPhase;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  detail?: string;
  durationMs?: number;
}

export interface OrionAgentProgressSnapshot {
  phase: OrionProgressPhase;
  headline: string;
  stages: OrionStageEntry[];
  steps: OrionPlanStep[];
  startedAt: number;
  finishedAt?: number;
  verified: boolean;
}

export interface OrionVerificationResult {
  verified: boolean;
  note: string;
  checkedTable?: string;
}

export type OrionPipelineExecutor = typeof executeOrionActionPipeline;
export type OrionActionVerifier = (
  action: OrionAction,
  result: OrionExecutionResult
) => Promise<OrionVerificationResult>;

const ACTION_HUMAN_LABELS: Partial<Record<OrionActionType, string>> = {
  create_broadcast: 'Publish school-wide notice',
  create_notice: 'Publish official notice',
  update_broadcast: 'Update notice entry',
  delete_broadcast: 'Delete notice entry',
  create_notification: 'Dispatch notification alert',
  create_reminder: 'Schedule reminder alert',
  notify_users: 'Send targeted user notification',
  notify_class: 'Notify selected class',
  notify_all: 'Send school-wide alert',
  create_event: 'Schedule school event',
  update_event: 'Update school event',
  delete_event: 'Remove school event',
  create_competition: 'Publish Life competition',
  update_competition: 'Update Life competition',
  delete_competition: 'Remove Life competition',
  register_competition: 'Register for competition',
  create_meeting: 'Schedule Veylentra Meet session',
  schedule_meeting: 'Schedule Veylentra Meet session',
  cancel_meeting: 'Cancel Veylentra Meet session',
  delete_meeting: 'Delete meeting entry',
  create_assignment: 'Assign class homework',
  create_homework: 'Assign class homework',
  update_assignment: 'Update homework entry',
  delete_assignment: 'Delete homework entry',
  delete_homework: 'Delete homework entry',
  delete_item: 'Remove matching database item',
  start_attendance: 'Open attendance roster',
  mark_attendance: 'Prepare attendance marking',
  get_assignments: 'Inspect homework assignments',
  get_homework: 'Inspect homework status',
  get_submissions: 'Analyze homework submissions',
  get_attendance: 'Analyze attendance logs',
  get_students: 'Load student roster insights',
  get_classes: 'Summarize class & section metrics',
  get_calendar: 'Inspect academic calendar',
  get_notifications: 'Fetch recent announcements',
  get_child_overview: 'Inspect linked ward overview',
  generate_report: 'Compile academic summary report',
  export_report: 'Prepare exportable report',
  daily_operations_summary: 'Compile operations summary',
  search_internet: 'Search live academic web sources',
  web_search: 'Search live web sources',
  generate_notes: 'Save study notes to vault',
  create_note: 'Save note to vault',
  create_calendar_event: 'Add calendar event',
  create_study_plan: 'Build structured study plan',
  add_study_planner: 'Add study planner slot',
  add_task: 'Add task to study list',
  complete_task: 'Mark study task complete',
  delete_task: 'Delete study task',
  general_chat: 'Synthesize response',
};

const MUTATION_TABLE_MAP: Partial<Record<OrionActionType, string>> = {
  create_broadcast: 'materials',
  create_notice: 'materials',
  update_broadcast: 'materials',
  create_event: 'life_events',
  update_event: 'life_events',
  create_competition: 'life_competitions',
  update_competition: 'life_competitions',
  create_meeting: 'meetings',
  schedule_meeting: 'meetings',
  create_assignment: 'homework',
  create_homework: 'homework',
  update_assignment: 'homework',
  create_calendar_event: 'calendar_events',
  create_note: 'notes',
  generate_notes: 'notes',
  create_notification: 'notifications',
  create_reminder: 'notifications',
  notify_users: 'notifications',
  notify_class: 'notifications',
  notify_all: 'notifications',
};

export function describeActionStep(action: OrionAction): string {
  return ACTION_HUMAN_LABELS[action.action] || `Run ${action.action.replace(/_/g, ' ')}`;
}

export async function verifyActionExecution(
  action: OrionAction,
  result: OrionExecutionResult,
  supabaseClient: any = supabase
): Promise<OrionVerificationResult> {
  if (!result.success) {
    return {
      verified: false,
      note: result.error || result.message || 'Execution returned failure status',
    };
  }

  const targetTable = MUTATION_TABLE_MAP[action.action];
  if (targetTable && result.recordId) {
    try {
      const { data, error } = await supabaseClient
        .from(targetTable)
        .select('id')
        .eq('id', result.recordId)
        .maybeSingle();

      if (error) {
        return {
          verified: false,
          checkedTable: targetTable,
          note: `Database read-back check failed (${error.message})`,
        };
      }

      if (!data?.id) {
        return {
          verified: false,
          checkedTable: targetTable,
          note: `Record ${result.recordId} not found in ${targetTable} after write`,
        };
      }

      return {
        verified: true,
        checkedTable: targetTable,
        note: `Confirmed persisted record in ${targetTable}`,
      };
    } catch (err: any) {
      return {
        verified: false,
        checkedTable: targetTable,
        note: `Verification query threw an exception (${err?.message || 'network error'})`,
      };
    }
  }

  if (action.action === 'web_search' || action.action === 'search_internet') {
    const srcCount = Array.isArray(result.data?.sources) ? result.data.sources.length : 0;
    if (srcCount === 0) {
      return {
        verified: false,
        note: 'Web search returned zero verified sources',
      };
    }
    return {
      verified: true,
      note: `Verified ${srcCount} external source citation${srcCount === 1 ? '' : 's'}`,
    };
  }

  if (result.error) {
    return {
      verified: false,
      note: result.error,
    };
  }

  return {
    verified: true,
    note: result.structuredCard
      ? 'Verified structured metrics from authorized live data'
      : 'Verified completion payload',
  };
}

export interface RunOrionAgentTaskParams {
  rawCommand: string;
  actions: OrionAction[];
  userContext: OrionUserContext;
  isConfirmed?: boolean;
  onProgress?: (snapshot: OrionAgentProgressSnapshot) => void;
  executor?: OrionPipelineExecutor;
  verifier?: OrionActionVerifier;
}

export interface RunOrionAgentTaskResult {
  results: OrionExecutionResult[];
  combinedSummary: string;
  structuredCards: OrionStructuredCard[];
  structuredData?: StructuredOrionPayload;
  pendingConfirmation?: {
    action: string;
    targetTitle: string;
    promptText: string;
    previewDetails?: Record<string, string>;
    actionObject?: OrionAction;
  };
  snapshot: OrionAgentProgressSnapshot;
}

function cloneSnapshot(snapshot: OrionAgentProgressSnapshot): OrionAgentProgressSnapshot {
  return {
    ...snapshot,
    stages: snapshot.stages.map((s) => ({ ...s })),
    steps: snapshot.steps.map((st) => ({ ...st })),
  };
}

export async function runOrionAgentTask({
  rawCommand,
  actions,
  userContext,
  isConfirmed = false,
  onProgress,
  executor = executeOrionActionPipeline,
  verifier = (act, res) => verifyActionExecution(act, res),
}: RunOrionAgentTaskParams): Promise<RunOrionAgentTaskResult> {
  const startedAt = Date.now();
  const safeActions = actions.length > 0 ? actions : [{ action: 'general_chat' as OrionActionType }];
  const needsVerificationStage = safeActions.some((a) => a.action !== 'general_chat' && a.action !== 'navigate_tab');

  const steps: OrionPlanStep[] = safeActions.map((act, idx) => ({
    id: `step-${idx + 1}`,
    label: describeActionStep(act),
    action: act.action,
    status: 'pending',
  }));

  const stages: OrionStageEntry[] = [
    { phase: 'analyzing', label: 'Analyzing intent', status: 'active' },
    { phase: 'planning', label: 'Planning steps', status: 'pending', detail: `${steps.length} step${steps.length > 1 ? 's' : ''}` },
    { phase: 'preparing', label: 'Checking permissions & prerequisites', status: 'pending' },
    { phase: 'executing', label: 'Executing action', status: 'pending' },
    ...(needsVerificationStage
      ? [{ phase: 'verifying' as const, label: 'Verifying outcome', status: 'pending' as const }]
      : []),
  ];

  const snapshot: OrionAgentProgressSnapshot = {
    phase: 'analyzing',
    headline: 'Understanding your request...',
    stages,
    steps,
    startedAt,
    verified: false,
  };

  const emit = () => {
    onProgress?.(cloneSnapshot(snapshot));
  };

  const setStageStatus = (
    phase: OrionProgressPhase,
    status: OrionStageEntry['status'],
    durationMs?: number,
    detail?: string
  ) => {
    const entry = snapshot.stages.find((s) => s.phase === phase);
    if (entry) {
      entry.status = status;
      if (durationMs !== undefined) entry.durationMs = durationMs;
      if (detail !== undefined) entry.detail = detail;
    }
  };

  emit();

  // Phase 1 -> 2: Analyzing to Planning
  const analyzeEnd = Date.now();
  setStageStatus('analyzing', 'completed', Math.max(1, analyzeEnd - startedAt));
  snapshot.phase = 'planning';
  snapshot.headline = `Mapped ${steps.length} execution step${steps.length > 1 ? 's' : ''}...`;
  setStageStatus('planning', 'active');
  emit();

  const planEnd = Date.now();
  setStageStatus('planning', 'completed', Math.max(1, planEnd - analyzeEnd));

  // Phase 3: Preparing — RBAC & prerequisite checks
  const prepStart = Date.now();
  snapshot.phase = 'preparing';
  snapshot.headline = 'Validating role permissions and prerequisites...';
  setStageStatus('preparing', 'active');
  emit();

  const role = (userContext.userRole || userContext.role || 'student').toLowerCase().trim();
  const deniedSteps: { index: number; reason: string }[] = [];
  const missingParamErrors: { index: number; prompt: string; missingFields: string[] }[] = [];

  for (let i = 0; i < safeActions.length; i++) {
    const act = safeActions[i];
    const paramCheck = validateOrionActionParameters(act, rawCommand);
    if (!paramCheck.valid && paramCheck.clarificationPrompt) {
      steps[i].status = 'blocked';
      steps[i].detail = `Missing: ${paramCheck.missingFields.join(', ')}`;
      missingParamErrors.push({
        index: i,
        prompt: paramCheck.clarificationPrompt,
        missingFields: paramCheck.missingFields,
      });
      continue;
    }

    const perm = validateActionPermission(act.action, role);
    if (!perm.allowed) {
      steps[i].status = 'blocked';
      steps[i].detail = perm.reason;
      deniedSteps.push({ index: i, reason: perm.reason || 'Authorization denied.' });
      continue;
    }

    if (act.action === 'get_child_overview') {
      const linkedCount =
        (userContext.linkedStudentIds?.length || 0) + (userContext.linkedStudents?.length || 0);
      if (linkedCount === 0) {
        const msg =
          'No verified linked ward found on this Parent session. Link your child in Parental Portal via OTP first.';
        steps[i].status = 'blocked';
        steps[i].detail = msg;
        deniedSteps.push({ index: i, reason: msg });
      }
    }
  }

  if (missingParamErrors.length > 0) {
    setStageStatus('preparing', 'failed', Math.max(1, Date.now() - prepStart), 'Needs clarification');
    snapshot.phase = 'clarifying';
    snapshot.headline = 'Additional details needed before executing.';
    snapshot.finishedAt = Date.now();
    snapshot.verified = false;
    emit();

    return {
      results: missingParamErrors.map((m) => ({
        success: false,
        action: safeActions[m.index].action,
        message: 'Needs clarification',
        summaryText: m.prompt,
        error: 'NEEDS_CLARIFICATION',
      })),
      combinedSummary: missingParamErrors[0].prompt,
      structuredCards: [],
      snapshot: cloneSnapshot(snapshot),
    };
  }

  if (deniedSteps.length > 0) {
    setStageStatus('preparing', 'failed', Math.max(1, Date.now() - prepStart), deniedSteps[0].reason);
    snapshot.phase = 'failed';
    snapshot.headline = 'Prerequisite or permission check failed.';
    snapshot.finishedAt = Date.now();
    snapshot.verified = false;
    emit();

    const blockedResults: OrionExecutionResult[] = deniedSteps.map((d) => ({
      success: false,
      action: safeActions[d.index].action,
      message: 'Blocked during prerequisite check',
      summaryText: d.reason,
      error: 'PREREQUISITE_OR_RBAC_FAILED',
    }));

    return {
      results: blockedResults,
      combinedSummary: deniedSteps.map((d) => d.reason).join('\n\n'),
      structuredCards: [],
      snapshot: cloneSnapshot(snapshot),
    };
  }

  setStageStatus('preparing', 'completed', Math.max(1, Date.now() - prepStart), `Authorized (${role})`);

  // Phase 4: Executing
  const execStart = Date.now();
  snapshot.phase = 'executing';
  snapshot.headline = steps[0]?.label || 'Running action...';
  setStageStatus('executing', 'active');
  steps.forEach((s) => {
    s.status = 'running';
  });
  emit();

  const pipelineRes = await executor(safeActions, userContext, rawCommand, isConfirmed);
  const execDuration = Math.max(1, Date.now() - execStart);

  // If confirmation required before write
  if (pipelineRes.pendingConfirmation) {
    setStageStatus('executing', 'completed', execDuration, 'Drafted preview · awaiting confirmation');
    steps.forEach((s) => {
      s.status = isConsequentialAction(s.action) ? 'pending' : s.status;
      s.detail = 'Waiting for explicit user confirmation';
    });
    snapshot.phase = 'awaiting_confirmation';
    snapshot.headline = 'Confirmation required before making changes.';
    snapshot.finishedAt = Date.now();
    snapshot.verified = false;
    emit();

    return {
      results: pipelineRes.results,
      combinedSummary: pipelineRes.combinedSummary,
      structuredCards: pipelineRes.structuredCards,
      structuredData: pipelineRes.structuredData,
      pendingConfirmation: pipelineRes.pendingConfirmation,
      snapshot: cloneSnapshot(snapshot),
    };
  }

  setStageStatus('executing', 'completed', execDuration);

  // Phase 5: Verification
  if (needsVerificationStage) {
    const verStart = Date.now();
    snapshot.phase = 'verifying';
    snapshot.headline = 'Verifying executed result...';
    setStageStatus('verifying', 'active');
    emit();

    let allVerified = true;
    const verificationWarnings: string[] = [];

    for (let i = 0; i < safeActions.length; i++) {
      const act = safeActions[i];
      const res = pipelineRes.results[i];
      if (!res) {
        steps[i].status = 'failed';
        steps[i].verificationNote = 'No execution result returned';
        allVerified = false;
        verificationWarnings.push(`Verification notice for ${act.action}: no execution result returned.`);
        continue;
      }

      steps[i].recordId = res.recordId;
      const ver = await verifier(act, res);
      steps[i].durationMs = Math.max(1, Math.round(execDuration / safeActions.length));
      steps[i].verificationNote = ver.note;

      if (res.success && ver.verified) {
        steps[i].status = 'verified';
      } else {
        steps[i].status = 'failed';
        allVerified = false;
        verificationWarnings.push(`Verification warning (${act.action}): ${ver.note}`);
      }
    }

    const verDuration = Math.max(1, Date.now() - verStart);
    if (allVerified) {
      setStageStatus('verifying', 'completed', verDuration, 'All outcomes verified');
      snapshot.phase = 'completed';
      snapshot.headline = 'Completed and verified.';
      snapshot.verified = true;
    } else {
      setStageStatus('verifying', 'failed', verDuration, verificationWarnings[0]);
      snapshot.phase = 'failed';
      snapshot.headline = 'Action finished with verification warnings or errors.';
      snapshot.verified = false;
    }
    snapshot.finishedAt = Date.now();
    emit();

    const finalSummary =
      verificationWarnings.length > 0 && pipelineRes.results.some((r) => r.success)
        ? `${pipelineRes.combinedSummary}\n\n⚠️ **Verification Check:** ${verificationWarnings.join(' ')}`
        : pipelineRes.combinedSummary;

    return {
      results: pipelineRes.results,
      combinedSummary: finalSummary,
      structuredCards: pipelineRes.structuredCards,
      structuredData: pipelineRes.structuredData,
      snapshot: cloneSnapshot(snapshot),
    };
  }

  // Non-verified direct completion (e.g. general_chat or pure UI navigation)
  const anyFailed = pipelineRes.results.some((r) => !r.success);
  steps.forEach((s, idx) => {
    s.status = pipelineRes.results[idx]?.success === false ? 'failed' : 'completed';
    s.durationMs = execDuration;
  });
  snapshot.phase = anyFailed ? 'failed' : 'completed';
  snapshot.headline = anyFailed ? 'Execution encountered an issue.' : 'Completed.';
  snapshot.verified = !anyFailed;
  snapshot.finishedAt = Date.now();
  emit();

  return {
    results: pipelineRes.results,
    combinedSummary: pipelineRes.combinedSummary,
    structuredCards: pipelineRes.structuredCards,
    structuredData: pipelineRes.structuredData,
    snapshot: cloneSnapshot(snapshot),
  };
}

export interface ServerOrionExecuteResponse {
  success: boolean;
  status: 'needs_clarification' | 'awaiting_confirmation' | 'completed' | 'forbidden' | 'unauthorized' | 'failed' | 'error';
  clarificationQuestion?: string;
  missingFields?: string[];
  pendingConfirmation?: {
    action: string;
    targetTitle: string;
    promptText: string;
    previewDetails?: Record<string, string>;
    actionObject?: OrionAction;
    plannedSteps?: OrionAction[];
  };
  plan?: OrionAction[];
  results?: any[];
  structuredData?: StructuredOrionPayload;
  webSources?: any[];
  webVideos?: any[];
  clientBridgeActions?: OrionAction[];
  refreshTables?: string[];
  finalResponse?: string;
  providerUsed?: string;
  modelUsed?: string;
  snapshot?: OrionAgentProgressSnapshot;
  error?: string;
}

export async function executeOrionViaServer(params: {
  command: string;
  actionPlan?: OrionAction[];
  confirmed?: boolean;
  activeTab?: string;
  modelOverride?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  userContext?: OrionUserContext;
}): Promise<ServerOrionExecuteResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Session lookup optional for PIN/demo accounts
  }

  if (params.userContext?.userId) {
    headers['x-veylentra-uid'] = String(params.userContext.userId);
  }
  if (params.userContext?.userEmail) {
    headers['x-veylentra-email'] = String(params.userContext.userEmail);
  }

  const resp = await fetch('/api/orion/execute', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      command: params.command,
      actionPlan: params.actionPlan,
      confirmed: Boolean(params.confirmed),
      activeTab: params.activeTab || 'dashboard',
      modelOverride: params.modelOverride || undefined,
      history: (params.history || []).slice(-6),
    }),
  });

  const payload = await resp.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Orion execution endpoint returned HTTP ${resp.status} without a readable JSON payload.`);
  }
  return payload as ServerOrionExecuteResponse;
}
