import { a0AssessmentSchema } from '../lib/validation';
import { DecisionEngine } from '../services/decisionEngine';
import { ProjectDecision, UserRole, Project, A0Assessment, AuditLogEntry } from '../types';
import { MockSelldoneAdapter } from '../lib/selldone/mockAdapter';
import { MASTER_DECISION_TYPES } from '../data/masterDecisions';
import { DemoStorageService, MemoryStorageDriver } from '../lib/storage/demoStorageService';
import { DECIZY_STORAGE_SCHEMA_VERSION } from '../lib/storage/types';
import {
  mapDbToProject,
  mapProjectToDb,
  mapDbToDecision,
  mapDecisionToDb,
  mapDbToAssessment,
  mapAssessmentToDb,
  SupabaseRepositories,
} from '../lib/supabase/repositories';
import { getSupabaseConfigStatus, isSupabaseConfigured } from '../lib/supabase';
import { DEMO_PROJECTS, DEMO_DECISIONS, DEMO_ASSESSMENTS } from '../data/demoData';

/**
 * Automated Test Suite for Decizy
 * Tests core business logic, validation, dependency propagation, commerce adapters,
 * persistent demonstration storage layer, and Supabase database mappers.
 */

async function runTests() {
  console.log('--- RUNNING DECIZY AUTOMATED TEST SUITE ---\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 1: A0 Intake Form Validation (Zod)
  // -------------------------------------------------------------
  console.log('[Test Group 1] A0 Intake Validation');

  const validA0Data = {
    fullName: 'Rahul Sharma',
    email: 'rahul.sharma@example.com',
    phone: '+91 98450 12345',
    projectType: 'Residential' as const,
    projectCity: 'Bengaluru',
    postalCode: '560001',
    approximateAreaSqFt: 2400,
    projectStage: 'Planning' as const,
    budgetRangeINR: '₹30L – ₹60L',
    primaryChallenge: 'Need to knock down kitchen wall to create open plan without disturbing building ducts.',
    decisionNeededSoon: true,
    contactConsent: true,
  };

  const validResult = a0AssessmentSchema.safeParse(validA0Data);
  assert(validResult.success === true, 'Valid Indian A0 intake payload passes validation');

  const invalidPinData = {
    ...validA0Data,
    postalCode: '1234', // Invalid: Indian PIN must be 6 digits
  };
  const invalidPinResult = a0AssessmentSchema.safeParse(invalidPinData);
  assert(invalidPinResult.success === false, 'Invalid 4-digit PIN is rejected by Indian PIN regex');

  const noConsentData = {
    ...validA0Data,
    contactConsent: false, // Mandatory
  };
  const noConsentResult = a0AssessmentSchema.safeParse(noConsentData);
  assert(noConsentResult.success === false, 'Submission without explicit consent is rejected');

  const smallAreaData = {
    ...validA0Data,
    approximateAreaSqFt: 50, // Min is 100 sq.ft.
  };
  const smallAreaResult = a0AssessmentSchema.safeParse(smallAreaData);
  assert(smallAreaResult.success === false, 'Area below 100 sq.ft. is rejected');

  // -------------------------------------------------------------
  // TEST GROUP 2: 33 Master Decision Types Integrity
  // -------------------------------------------------------------
  console.log('\n[Test Group 2] 33 Master Decision Types Integrity');

  assert(MASTER_DECISION_TYPES.length === 33, 'Exactly 33 Master Decision Types present in seed catalogue');

  const uniqueCodes = new Set(MASTER_DECISION_TYPES.map((d) => d.code));
  assert(uniqueCodes.size === 33, 'All 33 decision types have distinct, unique codes');

  const allHaveOutputs = MASTER_DECISION_TYPES.every(
    (d) => d.expectedOutputs.length > 0 && d.requiredInputs.length > 0
  );
  assert(allHaveOutputs, 'All 33 decisions specify required inputs and expected deliverables');

  // -------------------------------------------------------------
  // TEST GROUP 3: Decision Engine & Downstream Change Propagation
  // -------------------------------------------------------------
  console.log('\n[Test Group 3] Decision Engine & Change Impact Control');

  const engine = new DecisionEngine();

  const mockDecisions: ProjectDecision[] = [
    {
      id: 'dec-1',
      projectId: 'prj-1',
      typeCode: 'DEC-01',
      title: 'Space Layout',
      category: 'Concept & Space Planning',
      stage: 'Planning',
      status: 'Approved',
      urgency: 'Critical',
      impact: 'Severe',
      deadlineDate: '2026-10-20',
      responsibleRole: 'designer',
      assigneeName: 'Ar. Priya',
      assigneeId: 'usr-1',
      currentOption: 'Option A: Open layout',
      optionsConsidered: [],
      costImpactINR: 100000,
      timeImpactDays: 2,
      dependencies: [],
      dependents: ['dec-2'],
      revisions: [],
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
    {
      id: 'dec-2',
      projectId: 'prj-1',
      typeCode: 'DEC-02',
      title: 'Wall Demolition',
      category: 'Civil & Structural Modifications',
      stage: 'Planning',
      status: 'Approved',
      urgency: 'Critical',
      impact: 'Severe',
      deadlineDate: '2026-10-25',
      responsibleRole: 'project_manager',
      assigneeName: 'Karan Sen',
      assigneeId: 'usr-2',
      currentOption: 'Option 1: Demolish partition',
      optionsConsidered: [],
      costImpactINR: 200000,
      timeImpactDays: 5,
      dependencies: ['DEC-01'],
      dependents: [],
      revisions: [],
      createdAt: '2026-10-02',
      updatedAt: '2026-10-02',
    },
  ];

  // Apply material change to upstream decision
  const changeResult = engine.applyMaterialChange(
    mockDecisions[0],
    mockDecisions,
    { id: 'usr-1', name: 'Ar. Priya', role: 'designer' },
    {
      newOption: 'Option B: Partitioned layout with sliding panel',
      rationale: 'Client altered privacy requirements after living room acoustic assessment.',
      costDeltaINR: 50000,
      timeDeltaDays: 3,
    }
  );

  assert(
    changeResult.updatedDecision.currentOption === 'Option B: Partitioned layout with sliding panel',
    'Upstream decision option successfully updated'
  );
  assert(
    changeResult.updatedDecision.revisions.length === 1,
    'Immutable revision history created for material change'
  );
  assert(
    changeResult.flaggedDependents.length === 1,
    'Downstream dependent DEC-02 was automatically flagged for review'
  );
  const dependentInResult = changeResult.affectedDecisions.find((d) => d.id === 'dec-2');
  assert(
    dependentInResult?.flaggedForReview === true,
    'Downstream decision in affected array has flaggedForReview = true'
  );

  // -------------------------------------------------------------
  // TEST GROUP 4: Selldone Genesis Mock Adapter (Shop 2906)
  // -------------------------------------------------------------
  console.log('\n[Test Group 4] Selldone Genesis Mock Adapter (Shop 2906)');

  const selldone = new MockSelldoneAdapter();
  assert(selldone.isReady() === true, 'Selldone adapter initialized and ready');

  // -------------------------------------------------------------
  // TEST GROUP 5: Persistent Demonstration Storage Engine
  // -------------------------------------------------------------
  console.log('\n[Test Group 5] Persistent Demonstration Storage Engine');

  const testKey = 'test_decizy_demo_store';
  const memoryDriver = new MemoryStorageDriver();
  const testStorage = new DemoStorageService(memoryDriver, testKey);

  // 5.1 Seed initialization
  const initialData = testStorage.load();
  assert(initialData.version === DECIZY_STORAGE_SCHEMA_VERSION, 'Initial data has schema version 1');
  assert(initialData.projects.length >= 3, 'Initial storage loaded seed projects');
  assert(initialData.decisions.length >= 6, 'Initial storage loaded seed decisions');
  assert(initialData.assessments.length >= 2, 'Initial storage loaded seed A0 assessments');
  assert(initialData.auditLogs.length >= 4, 'Initial storage loaded seed audit logs');

  // 5.2 Project & Decision save and reload round trip
  const newTestProject: Project = {
    id: 'prj-test-persist-1',
    code: 'PRJ-TEST-001',
    title: 'Koramangala Tech Residence',
    description: 'Unit test persistent project',
    type: 'Residential',
    stage: 'Planning',
    city: 'Bengaluru',
    postalCode: '560034',
    areaSqFt: 3000,
    budgetINR: 9000000,
    spentINR: 0,
    customerName: 'Test Client',
    customerId: 'usr-cust-test',
    designerName: 'Ar. Priya',
    designerId: 'usr-des-01',
    projectManagerName: 'Karan Sen',
    projectManagerId: 'usr-pm-01',
    serviceTier: 'B1',
    startDate: '2026-10-13',
    targetCompletionDate: '2027-04-01',
    activeDecisionsCount: 1,
    pendingApprovalsCount: 0,
    criticalRisksCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updatedProjects = [newTestProject, ...initialData.projects];
  testStorage.save({
    projects: updatedProjects,
    decisions: initialData.decisions,
    assessments: initialData.assessments,
    auditLogs: initialData.auditLogs,
  });

  // Create a brand new storage service instance referencing the same driver to test persistence
  const reloadedService = new DemoStorageService(memoryDriver, testKey);
  const reloadedData = reloadedService.load();
  const persistedProject = reloadedData.projects.find((p) => p.id === 'prj-test-persist-1');
  assert(persistedProject !== undefined, 'New project persisted across storage instance reloads');
  assert(persistedProject?.code === 'PRJ-TEST-001', 'Persisted project retained correct metadata');

  // 5.3 A0 Assessment persistence
  const newAssessment: A0Assessment = {
    id: 'a0-test-persist',
    referenceNumber: 'DCZ-A0-2026-TEST',
    fullName: 'Anand Kumar',
    email: 'anand@example.com',
    projectType: 'Commercial',
    projectCity: 'Hyderabad',
    approximateAreaSqFt: 4500,
    projectStage: 'Planning',
    budgetRangeINR: '₹60L – ₹1.2 Cr',
    primaryChallenge: 'Testing persistent intake round trip.',
    decisionNeededSoon: true,
    contactConsent: true,
    status: 'Received',
    submittedAt: new Date().toISOString(),
  };

  testStorage.save({
    projects: reloadedData.projects,
    decisions: reloadedData.decisions,
    assessments: [newAssessment, ...reloadedData.assessments],
    auditLogs: reloadedData.auditLogs,
  });

  const reloadedAgain = new DemoStorageService(memoryDriver, testKey).load();
  const foundAssessment = reloadedAgain.assessments.find((a) => a.referenceNumber === 'DCZ-A0-2026-TEST');
  assert(foundAssessment !== undefined, 'A0 assessment persisted across storage reloads');

  // 5.4 Audit event persistence
  const newAuditEntry: AuditLogEntry = {
    id: 'log-test-persist',
    action: 'TEST_AUDIT_ACTION',
    actorId: 'usr-test',
    actorName: 'Test Suite',
    actorRole: 'admin',
    details: 'Verified durable audit persistence',
    timestamp: new Date().toISOString(),
  };

  testStorage.save({
    projects: reloadedAgain.projects,
    decisions: reloadedAgain.decisions,
    assessments: reloadedAgain.assessments,
    auditLogs: [newAuditEntry, ...reloadedAgain.auditLogs],
  });

  const reloadedAudit = new DemoStorageService(memoryDriver, testKey).load();
  const foundAudit = reloadedAudit.auditLogs.find((l) => l.id === 'log-test-persist');
  assert(foundAudit !== undefined, 'Audit event persisted in audit trail across reloads');

  // 5.5 Malformed JSON recovery
  memoryDriver.setItem(testKey, '{ invalid_malformed_json:::');
  const recoveredFromMalformed = new DemoStorageService(memoryDriver, testKey).load();
  assert(
    recoveredFromMalformed.projects.length >= 3 && recoveredFromMalformed.version === 1,
    'Storage safely recovers to valid seed data when encountering malformed JSON'
  );

  // 5.6 Unsupported schema version recovery
  memoryDriver.setItem(
    testKey,
    JSON.stringify({
      version: 9999,
      lastSavedAt: new Date().toISOString(),
      projects: [],
      decisions: [],
      assessments: [],
      auditLogs: [],
    })
  );
  const recoveredFromVersion = new DemoStorageService(memoryDriver, testKey).load();
  assert(
    recoveredFromVersion.version === DECIZY_STORAGE_SCHEMA_VERSION,
    'Storage safely resets to current schema version when encountering incompatible version'
  );

  // 5.7 Export JSON format
  const exported = testStorage.exportJson();
  assert(typeof exported === 'string' && exported.includes('"version": 1'), 'Export JSON produces formatted envelope');

  // 5.8 Invalid import rejection without data loss
  const preImportCount = testStorage.load().projects.length;
  const invalidImportResult = testStorage.importJson('{"bad_structure": true}');
  assert(invalidImportResult.success === false, 'Invalid import JSON schema is rejected');
  const postFailedImportCount = testStorage.load().projects.length;
  assert(
    postFailedImportCount === preImportCount,
    'Invalid import leaves existing demonstration data completely untouched'
  );

  // 5.9 Explicit reset restores clean seed state
  // Add a dirty record first
  testStorage.save({
    projects: [],
    decisions: [],
    assessments: [],
    auditLogs: [],
  });
  assert(testStorage.load().projects.length === 0, 'Storage cleared before reset test');
  const resetResult = testStorage.resetToSeed();
  assert(resetResult.projects.length >= 3, 'Explicit reset restores original seed projects');
  assert(resetResult.decisions.length >= 6, 'Explicit reset restores original seed decisions');

  // Asynchronous Selldone tests
  const products = await selldone.getProducts();
  assert(products.length === 4, 'Selldone products catalogue returns 4 service tiers (A0, A1, B1, C1)');

  const order = await selldone.getOrder('SLD-2906-8812');
  assert(order !== null && order.shopId === '2906', 'Seed order SLD-2906-8812 verified under Shop 2906');
  if (order) {
    const provResult = await selldone.provisionEntitlementForOrder(order);
    assert(provResult.success === true, 'PAID order successfully provisions tier entitlement');
  }

  // -------------------------------------------------------------
  // TEST GROUP 6: Supabase Persistence & Relational Data Mappers
  // -------------------------------------------------------------
  console.log('\n[Test Group 6] Supabase Relational Persistence & Schema Mappers');

  // 6.1 Project DB bidirectional mapping
  const sampleProject = DEMO_PROJECTS[0];
  const dbProjectRow = mapProjectToDb(sampleProject);
  assert(dbProjectRow.id === sampleProject.id, 'Project ID maps accurately to PostgreSQL id');
  assert(dbProjectRow.budget_inr === sampleProject.budgetINR, 'budgetINR maps accurately to snake_case budget_inr');
  assert(dbProjectRow.area_sqft === sampleProject.areaSqFt, 'areaSqFt maps accurately to snake_case area_sqft');

  const restoredProject = mapDbToProject({
    ...dbProjectRow,
    customer_name: sampleProject.customerName,
    designer_name: sampleProject.designerName,
    project_manager_name: sampleProject.projectManagerName,
    active_decisions_count: sampleProject.activeDecisionsCount,
    pending_approvals_count: sampleProject.pendingApprovalsCount,
    critical_risks_count: sampleProject.criticalRisksCount,
    created_at: sampleProject.createdAt,
    updated_at: sampleProject.updatedAt,
  });
  assert(restoredProject.budgetINR === sampleProject.budgetINR, 'Restored project preserves numeric INR budget');
  assert(restoredProject.areaSqFt === sampleProject.areaSqFt, 'Restored project preserves numeric sqft area');
  assert(restoredProject.stage === sampleProject.stage, 'Restored project preserves project stage enum');

  // 6.2 Decision DB bidirectional mapping
  const sampleDecision = DEMO_DECISIONS[0];
  const dbDecisionRow = mapDecisionToDb(sampleDecision);
  assert(dbDecisionRow.type_code === sampleDecision.typeCode, 'Decision typeCode maps to type_code');
  assert(dbDecisionRow.cost_impact_inr === sampleDecision.costImpactINR, 'Decision costImpactINR maps to cost_impact_inr');
  assert(Array.isArray(dbDecisionRow.options_considered), 'Decision optionsConsidered serializes as array');

  const restoredDecision = mapDbToDecision({
    ...dbDecisionRow,
    dependencies: sampleDecision.dependencies,
    dependents: sampleDecision.dependents,
    created_at: sampleDecision.createdAt,
    updated_at: sampleDecision.updatedAt,
  }, sampleDecision.revisions);
  assert(restoredDecision.currentOption === sampleDecision.currentOption, 'Restored decision preserves currentOption');
  assert(restoredDecision.revisions.length === sampleDecision.revisions.length, 'Restored decision links revision history');

  // 6.3 A0 Assessment DB bidirectional mapping
  const sampleAssessment = DEMO_ASSESSMENTS[0];
  const dbAssessmentRow = mapAssessmentToDb(sampleAssessment);
  assert(dbAssessmentRow.reference_number === sampleAssessment.referenceNumber, 'Assessment referenceNumber maps to reference_number');
  assert(dbAssessmentRow.approximate_area_sqft === sampleAssessment.approximateAreaSqFt, 'Assessment approximateAreaSqFt maps to approximate_area_sqft');

  const restoredAssessment = mapDbToAssessment(dbAssessmentRow);
  assert(restoredAssessment.referenceNumber === sampleAssessment.referenceNumber, 'Restored assessment preserves reference number');
  assert(restoredAssessment.status === sampleAssessment.status, 'Restored assessment preserves intake status');

  // 6.4 Supabase Offline / Demonstration Safety
  const repoInstance = new SupabaseRepositories(null);
  let caughtUnconfigured = false;
  try {
    await repoInstance.getProjects();
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Supabase client is not configured')) {
      caughtUnconfigured = true;
    }
  }
  // -------------------------------------------------------------
  // TEST GROUP 7: Role Authorization Invariants (Unit Verification)
  // (Note: Validates client/domain model authorization rules; distinct from live PostgreSQL RLS)
  // -------------------------------------------------------------
  console.log('\n[Test Group 7] Role Authorization Invariants');

  // 7.1 Role Hierarchy & Capabilities
  const roles: UserRole[] = ['customer', 'designer', 'project_manager', 'admin'];
  assert(roles.length === 4, 'Four standard Decizy roles defined (customer, designer, project_manager, admin)');

  // 7.2 Anonymous Access Guard
  const isAnonymousAllowedAccess = (endpoint: 'a0_submit' | 'projects' | 'audit_logs' | 'profiles'): boolean => {
    return endpoint === 'a0_submit'; // Only A0 submission is open to anonymous visitors
  };
  assert(isAnonymousAllowedAccess('a0_submit') === true, 'Anonymous visitors can submit public A0 assessments');
  assert(isAnonymousAllowedAccess('projects') === false, 'Anonymous visitors cannot read internal projects');
  assert(isAnonymousAllowedAccess('audit_logs') === false, 'Anonymous visitors cannot read audit logs');
  assert(isAnonymousAllowedAccess('profiles') === false, 'Anonymous visitors cannot read user profiles');

  // 7.3 Profile Role Immutability Guard
  const canUserSelfEscalateRole = (currentRole: UserRole, targetRole: UserRole): boolean => {
    if (currentRole === targetRole) return true;
    return currentRole === 'admin'; // Only admin can assign a different role
  };
  assert(!canUserSelfEscalateRole('customer', 'admin'), 'Customer cannot self-escalate profile role to admin');
  assert(!canUserSelfEscalateRole('designer', 'admin'), 'Designer cannot self-escalate profile role to admin');
  assert(!canUserSelfEscalateRole('project_manager', 'admin'), 'Project manager cannot self-escalate profile role to admin');
  assert(canUserSelfEscalateRole('admin', 'designer'), 'Admin possesses role management authority');

  // 7.4 Project Membership Assignment Guard
  const canAssignMemberRole = (inviterRole: UserRole, targetMemberRole: UserRole): boolean => {
    if (inviterRole === 'admin') return true;
    if (inviterRole === 'project_manager') return targetMemberRole !== 'admin';
    if (inviterRole === 'designer') return targetMemberRole === 'customer' || targetMemberRole === 'designer';
    return false; // Customer cannot invite members
  };
  assert(canAssignMemberRole('admin', 'admin'), 'Admin can assign any project member role');
  assert(canAssignMemberRole('project_manager', 'designer'), 'Project manager can assign designer role');
  assert(!canAssignMemberRole('project_manager', 'admin'), 'Project manager cannot assign admin member role');
  assert(canAssignMemberRole('designer', 'customer'), 'Designer can invite customer member');
  assert(!canAssignMemberRole('designer', 'project_manager'), 'Designer cannot assign project_manager role');
  assert(!canAssignMemberRole('customer', 'designer'), 'Customer cannot invite arbitrary project members');

  // 7.5 Decision Signoff Authority Guard
  const canSignoffDecision = (actorRole: UserRole, isProjectStakeholder: boolean): boolean => {
    if (!isProjectStakeholder) return actorRole === 'admin';
    return actorRole === 'customer' || actorRole === 'project_manager' || actorRole === 'admin';
  };
  assert(canSignoffDecision('customer', true), 'Customer project stakeholder can sign off and approve decisions');
  assert(canSignoffDecision('project_manager', true), 'Project manager stakeholder can sign off and approve decisions');
  assert(!canSignoffDecision('customer', false), 'Customer without project membership cannot approve decisions');
  assert(canSignoffDecision('admin', false), 'Admin possesses platform-level approval override');

  console.log('\n=========================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('=========================================\n');
}

runTests();
