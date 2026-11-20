from pipeline_stats import summarize


def test_summarize_reports_rate_duration_and_slowest_jobs():
    pipelines = [
        {"id": 1, "status": "success", "duration": 600},
        {"id": 2, "status": "failed", "duration": 300},
        {"id": 3, "status": "running", "duration": None},
    ]
    jobs = {
        1: [{"name": "build", "duration": 200}, {"name": "lint", "duration": 20}],
        2: [{"name": "build", "duration": 180}, {"name": "lint", "duration": 30}],
    }
    out = summarize(pipelines, jobs)
    assert "Pipelines analysed: 2" in out
    assert "Success rate: 50%" in out
    assert "Median duration: 7.5 min" in out
    assert out.index("| build |") < out.index("| lint |")


def test_summarize_handles_no_pipelines():
    assert summarize([], {}) == "No finished pipelines found."
