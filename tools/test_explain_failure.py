import os

import explain_failure as ef


def test_clean_log_removes_colours_and_sections():
    raw = "section_start:1700000000:step_script\r\x1b[0K\x1b[31mERROR\x1b[0m: test failed\nsection_end:1700000001:step_script\r\n"
    assert ef.clean_log(raw).strip() == "ERROR: test failed"


def test_tail_keeps_the_end_of_the_log():
    log = "\n".join(f"line {i}" for i in range(1000))
    out = ef.tail(log, 100)
    assert out.startswith("[... earlier output trimmed ...]")
    assert out.endswith("line 999")
    assert "line 1\n" not in out


def test_tail_leaves_short_logs_alone():
    assert ef.tail("short", 100) == "short"


def test_redact_known_token_formats():
    text = (
        "push with glpat-abcdefghijklmnopqrstuv\n"
        "key sk-ant-api03-abcdefghijklmnopqrstuvwxyz\n"
        "aws AKIAABCDEFGHIJKLMNOP\n"
        "Authorization: Bearer abc.def.ghijklmnopqrstu\n"
        "DB_PASSWORD=hunter2hunter2\n"
    )
    out = ef.redact(text, env={})
    for secret in ["glpat-abcdef", "sk-ant-api03", "AKIAABCDEFGHIJKLMNOP", "abc.def.ghijk", "hunter2"]:
        assert secret not in out
    assert "Bearer [REDACTED]" in out
    assert "DB_PASSWORD=[REDACTED]" in out


def test_redact_values_of_secret_env_vars():
    env = {"MY_DEPLOY_TOKEN": "s3cr3t-value-123", "CI_PROJECT_NAME": "taskmanager"}
    out = ef.redact("cloning with s3cr3t-value-123 into taskmanager", env=env)
    assert "s3cr3t-value-123" not in out
    assert "taskmanager" in out  # non-secret variables are kept


def test_redact_private_key_block():
    text = "-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----"
    assert ef.redact(text, env={}) == "[REDACTED]"


def test_prompt_and_note_mention_every_job():
    jobs = [
        ef.FailedJob(1, "test: [task-service]", "test", "https://gitlab.example/jobs/1", "boom"),
        ef.FailedJob(2, "trivy:repo", "security", "https://gitlab.example/jobs/2", "CVE-1"),
    ]
    prompt = ef.build_prompt(jobs)
    assert "test: [task-service]" in prompt and "trivy:repo" in prompt and "CVE-1" in prompt
    note = ef.format_note("Root cause: X", jobs)
    assert note.startswith(ef.NOTE_HEADER)
    assert "[trivy:repo](https://gitlab.example/jobs/2)" in note
    assert ef.DISCLAIMER in note


class FakeGitLab:
    def __init__(self, jobs, logs):
        self.jobs, self.logs, self.notes = jobs, logs, []

    def failed_jobs(self, pipeline_id):
        return self.jobs

    def job_log(self, job_id):
        return self.logs[job_id]

    def comment_on_mr(self, mr_iid, body):
        self.notes.append((mr_iid, body))


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self.payload


class FakeSession:
    def __init__(self):
        self.sent = None

    def post(self, url, headers, json, timeout):
        self.sent = json
        return FakeResponse({"content": [{"type": "text", "text": "Root cause: missing env var"}]})


def test_run_posts_redacted_summary_on_the_mr(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    job = ef.FailedJob(7, "build: [web-gateway]", "build", "https://gitlab.example/jobs/7")
    gitlab = FakeGitLab([job], {7: "token=glpat-abcdefghijklmnopqrstuv\nERROR: build failed"})
    llm = FakeSession()
    env = {"CI_PIPELINE_ID": "1", "CI_MERGE_REQUEST_IID": "42", "ANTHROPIC_API_KEY": "sk-ant-test-key-1234567890"}

    assert ef.run(env, gitlab=gitlab, llm_session=llm) == 0

    sent_prompt = llm.sent["messages"][0]["content"]
    assert "glpat-" not in sent_prompt and "ERROR: build failed" in sent_prompt
    assert llm.sent["model"] == ef.DEFAULT_MODEL
    assert gitlab.notes[0][0] == "42"
    assert "missing env var" in gitlab.notes[0][1]
    assert os.path.exists(tmp_path / ef.REPORT_FILE)


def test_run_without_api_key_is_a_dry_run(capsys):
    job = ef.FailedJob(1, "lint", "lint", "u")
    gitlab = FakeGitLab([job], {1: "eslint error"})
    assert ef.run({"CI_PIPELINE_ID": "1"}, gitlab=gitlab) == 0
    assert "dry run" in capsys.readouterr().out
    assert gitlab.notes == []


def test_run_with_no_failed_jobs():
    assert ef.run({"CI_PIPELINE_ID": "1"}, gitlab=FakeGitLab([], {})) == 0
