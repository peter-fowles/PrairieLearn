import * as path from 'path';

import sha256 from 'crypto-js/sha256.js';
import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import fs from 'fs-extra';
import { z } from 'zod';

import * as error from '@prairielearn/error';
import { flash } from '@prairielearn/flash';
import * as sqldb from '@prairielearn/postgres';
import { run } from '@prairielearn/run';

import { b64EncodeUnicode } from '../../lib/base64-util.js';
import { AssessmentModuleSchema, AssessmentSetSchema, IdSchema } from '../../lib/db-types.js';
import {
  AssessmentCopyEditor,
  AssessmentDeleteEditor,
  AssessmentRenameEditor,
  FileModifyEditor,
  MultiEditor,
  propertyValueWithDefault,
} from '../../lib/editors.js';
import { httpPrefixForCourseRepo } from '../../lib/github.js';
import { getPaths } from '../../lib/instructorFiles.js';
import { formatJsonWithPrettier } from '../../lib/prettier.js';
import { encodePath } from '../../lib/uri-util.js';
import { getCanonicalHost } from '../../lib/url.js';

import { InstructorAssessmentSettings } from './instructorAssessmentSettings.html.js';

const router = Router();
const sql = sqldb.loadSqlEquiv(import.meta.url);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tids = await sqldb.queryRows(
      sql.tids,
      { course_instance_id: res.locals.course_instance.id },
      z.string(),
    );
    const assessmentSets = await sqldb.queryRows(
      sql.select_assessment_sets,
      { course_id: res.locals.course.id },
      AssessmentSetSchema,
    );
    const assessmentModules = await sqldb.queryRows(
      sql.select_assessment_modules,
      { course_id: res.locals.course.id },
      AssessmentModuleSchema,
    );
    const host = getCanonicalHost(req);
    const studentLink = new URL(
      `${res.locals.plainUrlPrefix}/course_instance/${res.locals.course_instance.id}/assessment/${res.locals.assessment.id}`,
      host,
    ).href;
    const publicLink = new URL(
      `${res.locals.plainUrlPrefix}/public/course_instance/${res.locals.course_instance.id}/assessment/${res.locals.assessment.id}/questions`,
      host,
    ).href;
    const infoAssessmentPath = encodePath(
      path.join(
        'courseInstances',
        res.locals.course_instance.short_name,
        'assessments',
        res.locals.assessment.tid,
        'infoAssessment.json',
      ),
    );
    const fullInfoAssessmentPath = path.join(res.locals.course.path, infoAssessmentPath);

    const infoAssessmentPathExists = await fs.pathExists(fullInfoAssessmentPath);

    let origHash = '';
    if (infoAssessmentPathExists) {
      origHash = sha256(
        b64EncodeUnicode(await fs.readFile(fullInfoAssessmentPath, 'utf8')),
      ).toString();
    }

    let assessmentGHLink: string | null = null;
    if (res.locals.course.example_course) {
      // The example course is not found at the root of its repository, so its path is hardcoded
      assessmentGHLink = `https://github.com/PrairieLearn/PrairieLearn/tree/master/exampleCourse/courseInstances/${res.locals.course_instance.short_name}/assessments/${res.locals.assessment.tid}`;
    } else if (res.locals.course.repository) {
      const githubPrefix = httpPrefixForCourseRepo(res.locals.course.repository);
      if (githubPrefix) {
        assessmentGHLink = `${githubPrefix}/tree/${res.locals.course.branch}/courseInstances/${res.locals.course_instance.short_name}/assessments/${res.locals.assessment.tid}`;
      }
    }

    const canEdit =
      res.locals.authz_data.has_course_permission_edit && !res.locals.course.example_course;

    res.send(
      InstructorAssessmentSettings({
        resLocals: res.locals,
        origHash,
        assessmentGHLink,
        tids,
        studentLink,
        publicLink,
        infoAssessmentPath,
        assessmentSets,
        assessmentModules,
        canEdit,
      }),
    );
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (req.body.__action === 'copy_assessment') {
      const editor = new AssessmentCopyEditor({
        locals: res.locals as any,
      });
      const serverJob = await editor.prepareServerJob();
      try {
        await editor.executeWithServerJob(serverJob);
      } catch {
        return res.redirect(res.locals.urlPrefix + '/edit_error/' + serverJob.jobSequenceId);
      }

      const assessmentId = await sqldb.queryRow(
        sql.select_assessment_id_from_uuid,
        { uuid: editor.uuid, course_instance_id: res.locals.course_instance.id },
        IdSchema,
      );

      flash(
        'success',
        'Assessment copied successfully. You are now viewing your copy of the assessment.',
      );
      res.redirect(res.locals.urlPrefix + '/assessment/' + assessmentId + '/settings');
    } else if (req.body.__action === 'delete_assessment') {
      const editor = new AssessmentDeleteEditor({
        locals: res.locals as any,
      });
      const serverJob = await editor.prepareServerJob();
      try {
        await editor.executeWithServerJob(serverJob);
        res.redirect(res.locals.urlPrefix + '/instance_admin/assessments');
      } catch {
        res.redirect(res.locals.urlPrefix + '/edit_error/' + serverJob.jobSequenceId);
      }
    } else if (req.body.__action === 'update_assessment') {
      const infoAssessmentPath = path.join(
        res.locals.course.path,
        'courseInstances',
        res.locals.course_instance.short_name,
        'assessments',
        res.locals.assessment.tid,
        'infoAssessment.json',
      );
      if (!(await fs.pathExists(infoAssessmentPath))) {
        throw new error.HttpStatusError(400, 'infoAssessment.json does not exist');
      }

      if (!req.body.aid) {
        throw new error.HttpStatusError(400, `Invalid TID (was falsy): ${req.body.aid}`);
      }
      if (!/^[-A-Za-z0-9_/]+$/.test(req.body.aid)) {
        throw new error.HttpStatusError(
          400,
          `Invalid TID (was not only letters, numbers, dashes, slashes, and underscores, with no spaces): ${req.body.id}`,
        );
      }

      const paths = getPaths(undefined, res.locals);

      const assessmentInfo = JSON.parse(await fs.readFile(infoAssessmentPath, 'utf8'));
      assessmentInfo.title = req.body.title;
      assessmentInfo.set = req.body.set;
      assessmentInfo.number = req.body.number;
      if (assessmentInfo.module != null || req.body.module !== 'Default') {
        assessmentInfo.module = req.body.module;
      }
      const normalizedText = req.body.text?.replace(/\r\n/g, '\n');
      assessmentInfo.text = propertyValueWithDefault(assessmentInfo.text, normalizedText, '');
      assessmentInfo.allowIssueReporting = propertyValueWithDefault(
        assessmentInfo.allowIssueReporting,
        req.body.allow_issue_reporting === 'on',
        true,
      );
      assessmentInfo.allowPersonalNotes = propertyValueWithDefault(
        assessmentInfo.allowPersonalNotes,
        req.body.allow_personal_notes === 'on',
        true,
      );
      if (res.locals.assessment.type === 'Exam') {
        assessmentInfo.multipleInstance = propertyValueWithDefault(
          assessmentInfo.multipleInstance,
          req.body.multiple_instance === 'on',
          false,
        );
        assessmentInfo.autoClose = propertyValueWithDefault(
          assessmentInfo.autoClose,
          req.body.auto_close === 'on',
          true,
        );
        assessmentInfo.requireHonorCode = propertyValueWithDefault(
          assessmentInfo.requireHonorCode,
          req.body.require_honor_code === 'on',
          true,
        );
        assessmentInfo.honorCode = propertyValueWithDefault(
          assessmentInfo.honorCode,
          req.body.honor_code?.replace(/\r\n/g, '\n').trim(),
          '',
        );
      }

      const formattedJson = await formatJsonWithPrettier(JSON.stringify(assessmentInfo));

      const tid_new = run(() => {
        try {
          return path.normalize(req.body.aid);
        } catch {
          throw new error.HttpStatusError(
            400,
            `Invalid TID (could not be normalized): ${req.body.aid}`,
          );
        }
      });

      const editor = new MultiEditor(
        {
          locals: res.locals as any,
          // This won't reflect if the operation is an update or a rename; we think that's OK.
          description: `${res.locals.course_instance.short_name}: Update assessment ${res.locals.assessment.tid}`,
        },
        [
          // Each of these editors will no-op if there wasn't any change.
          new FileModifyEditor({
            locals: res.locals as any,
            container: {
              rootPath: paths.rootPath,
              invalidRootPaths: paths.invalidRootPaths,
            },
            filePath: infoAssessmentPath,
            editContents: b64EncodeUnicode(formattedJson),
            origHash: req.body.orig_hash,
          }),
          new AssessmentRenameEditor({ locals: res.locals as any, tid_new }),
        ],
      );
      const serverJob = await editor.prepareServerJob();
      try {
        await editor.executeWithServerJob(serverJob);
      } catch {
        return res.redirect(res.locals.urlPrefix + '/edit_error/' + serverJob.jobSequenceId);
      }

      flash('success', 'Assessment updated successfully');
      return res.redirect(req.originalUrl);
    } else {
      throw new error.HttpStatusError(400, `unknown __action: ${req.body.__action}`);
    }
  }),
);

export default router;
