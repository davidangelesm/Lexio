from main import app


def test_api_does_not_expose_document_link_routes():
    paths = app.openapi()["paths"]
    assert not any("/files" in path for path in paths)
