import asyncHandler = require('express-async-handler');
import * as express from 'express';
import * as fs from 'fs-extra';
import * as sqldb from '@prairielearn/postgres';
import * as error from '@prairielearn/error';
import { z } from 'zod';

import { CourseInstanceAddEditor } from '../../lib/editors';
import { idsEqual } from '../../lib/id';
import { selectCourseInstancesWithStaffAccess } from '../../models/course-instances';
import { CourseInstanceSchema, IdSchema } from '../../lib/db-types';
import {
  InstructorCourseAdminInstances,
  CourseInstanceAuthzRow,
} from './instructorCourseAdminInstances.html';

const router = express.Router();
const sql = sqldb.loadSqlEquiv(__filename);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    try {
      fs.access(res.locals.course.path);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.locals.needToSync = true;
      } else {
        throw new Error('Invalid course path');
      }
    }

    const courseInstances: CourseInstanceAuthzRow[] = await selectCourseInstancesWithStaffAccess({
      course_id: res.locals.course.id,
      user_id: res.locals.user.user_id,
      authn_user_id: res.locals.authn_user.user_id,
      is_administrator: res.locals.is_administrator,
      authn_is_administrator: res.locals.authz_data.authn_is_administrator,
    });
    const enrollmentCounts = await sqldb.queryRows(
      sql.select_enrollment_counts,
      { course_id: res.locals.course.id },
      z.object({ course_instance_id: CourseInstanceSchema.shape.id, number: z.number() }),
    );
    courseInstances.forEach((ci) => {
      const row = enrollmentCounts.find((row) => idsEqual(row.course_instance_id, ci.id));
      ci.number = row?.number || 0;
    });
    res.send(InstructorCourseAdminInstances({ resLocals: res.locals, courseInstances }));
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (req.body.__action === 'add_course_instance') {
      const editor = new CourseInstanceAddEditor({
        locals: res.locals,
      });
      const serverJob = await editor.prepareServerJob();
      try {
        await editor.executeWithServerJob(serverJob);
      } catch (err) {
        res.redirect(res.locals.urlPrefix + '/edit_error/' + serverJob.jobSequenceId);
        return;
      }

      const courseInstanceId = await sqldb.queryRow(
        sql.select_course_instance_id_from_uuid,
        {
          uuid: editor.uuid,
          course_id: res.locals.course.id,
        },
        IdSchema,
      );

      res.redirect(
        res.locals.plainUrlPrefix +
          '/course_instance/' +
          courseInstanceId +
          '/instructor/instance_admin/settings',
      );
    } else {
      throw new error.HttpStatusError(400, `unknown __action: ${req.body.__action}`);
    }
  }),
);

export default router;
