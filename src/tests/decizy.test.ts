import { a0AssessmentSchema } from '../lib/validation';
import { DecisionEngine } from '../services/decisionEngine';
import { ProjectDecision, UserRole } from '../types';
import { MockSelldoneAdapter } from '../lib/selldone/mockAdapter';
import { MASTER_DECISION_TYPES } from '../data/masterDecisions';

/**
 * Automated Test Suite for Decizy
 * Tests core business logic, validation, dependency propagation, and commerce adapters.
 */

function runTests() {
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
    projectType: 'Residential',
    projectCity: 'Bengaluru',
    postalCode: '560001',
    approximateAreaSqFt: 2400,
    projectStage: 'Planning',
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
  // TEST GROUP 2: 33 Master Decision Catalogue Integrity
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
  // TEST GROUP 4: Selldone Commerce Mock Adapter
  // -------------------------------------------------------------
  console.log('\n[Test Group 4] Selldone Genesis Mock Adapter (Shop 2906)');

  const selldone = new MockSelldoneAdapter();
  assert(selldone.isReady() === true, 'Selldone adapter initialized and ready');

  const productsPromise = selldone.getProducts();
  productsPromise.then((products) => {
    assert(products.length === 4, 'Selldone products catalogue returns 4 service tiers (A0, A1, B1, C1)');
  });

  const orderPromise = selldone.getOrder('SLD-2906-8812');
  orderPromise.then((order) => {
    assert(order !== null && order.shopId === '2906', 'Seed order SLD-2906-8812 verified under Shop 2906');
    if (order) {
      selldone.provisionEntitlementForOrder(order).then((provResult) => {
        assert(provResult.success === true, 'PAID order successfully provisions tier entitlement');
      });
    }
  });

  console.log('\n=========================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('=========================================\n');
}

runTests();
