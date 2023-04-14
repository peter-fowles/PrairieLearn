const { enqueueBatchedMigration } = require('@prairielearn/migrations');

export default async function () {
  await enqueueBatchedMigration('20240210165255_variants_course_id');
}
