const { enqueueBatchedMigration } = require('@prairielearn/migrations');

module.exports = async function () {
  await enqueueBatchedMigration('20240210165255_variants_course_id');
}
