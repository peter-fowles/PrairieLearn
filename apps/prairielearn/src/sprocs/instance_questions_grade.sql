CREATE FUNCTION
    instance_questions_grade(
        instance_question_id bigint,
        submission_score DOUBLE PRECISION,
        grading_job_id bigint,
        authn_user_id bigint
    ) RETURNS VOID
AS $$
DECLARE
    instance_question_open boolean;
    new_values record;
    new_instance_question instance_questions%ROWTYPE;
BEGIN
    SELECT iq.open INTO instance_question_open
    FROM instance_questions AS iq
    WHERE iq.id = instance_question_id;

    IF NOT instance_question_open THEN
        -- this shouldn't happen, so log an error
        --
        -- TODO: We should actually work to prevent this from happening
        -- farther upstream, and avoid recording an issue here.
        PERFORM issues_insert_for_variant(
            v.id,
            'Submission when instance question is closed', -- student message
            '', -- instructor message
            false, -- manually reported
            false, -- course-caused
            jsonb_build_object('grading_job_id', grading_job_id), -- course data
            '{}'::jsonb, -- system data
            -- The first one is user_id, the second is authn_user_id. We can't
            -- differentiate between the two at this point, so we just use the
            -- same value for both.
            instance_questions_grade.authn_user_id,
            instance_questions_grade.authn_user_id
        )
        FROM
            grading_jobs AS gj
            JOIN submissions AS s ON (s.id = gj.submission_id)
            JOIN variants AS v ON (v.id = s.variant_id)
        WHERE
            gj.id = grading_job_id;

        RETURN;
    END IF;

    SELECT * INTO new_values
    FROM instance_questions_points(instance_question_id, submission_score);

    UPDATE instance_questions AS iq
    SET
        open = new_values.open,
        status = new_values.status,
        auto_points = new_values.auto_points,
        points = new_values.points,
        score_perc = new_values.score_perc,
        highest_submission_score = new_values.highest_submission_score,
        current_value = new_values.current_value,
        points_list = new_values.points_list,
        variants_points_list = new_values.variants_points_list,
        number_attempts = iq.number_attempts + 1
    WHERE
        iq.id = instance_question_id;

    INSERT INTO question_score_logs
        (instance_question_id, auth_user_id, max_points, max_auto_points,
         points, auto_points, score_perc, grading_job_id)
    VALUES
        (instance_question_id, authn_user_id, new_values.max_points, new_values.max_auto_points,
         new_values.points, new_values.auto_points, new_values.score_perc, grading_job_id);

    PERFORM instance_questions_calculate_stats(instance_question_id);
END;
$$ LANGUAGE plpgsql VOLATILE;
