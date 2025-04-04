import morphdom from 'morphdom';

import { decodeData, onDocumentReady } from '@prairielearn/browser-utils';

import {
  InstructorInstanceAdminBillingForm,
  type InstructorInstanceAdminBillingFormProps,
} from '../../src/ee/lib/billing/components/InstructorInstanceAdminBillingForm.html.js';
import { type PlanName } from '../../src/ee/lib/billing/plans-types.js';

onDocumentReady(() => {
  const billingForm = document.querySelector<HTMLFormElement>('.js-billing-form');
  const initialProps = decodeData<InstructorInstanceAdminBillingFormProps>('billing-form-data');

  const studentBillingCheckbox = document.querySelector<HTMLInputElement>('#studentBillingEnabled');
  const computeCheckbox = document.querySelector<HTMLInputElement>('#computeEnabled');

  if (!billingForm || !studentBillingCheckbox || !computeCheckbox) return;

  billingForm.addEventListener('change', () => {
    const basicPlanEnabled = studentBillingCheckbox.checked;
    const computePlanEnabled = computeCheckbox.checked;

    const requiredPlans: PlanName[] = [];
    if (basicPlanEnabled) requiredPlans.push('basic');
    if (computePlanEnabled) requiredPlans.push('compute');

    morphdom(
      billingForm,
      InstructorInstanceAdminBillingForm({
        ...initialProps,
        desiredRequiredPlans: requiredPlans,
      }).toString(),
    );
  });
});
