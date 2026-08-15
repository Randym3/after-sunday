from app.services.email import render_test_email_html


def test_html_uses_org_name_escaped():
    html = render_test_email_html("Hello body", "Grace <Church>")
    assert "Grace &lt;Church&gt;" in html
    assert "Hello body" in html


def test_html_defaults_to_after_sunday():
    html = render_test_email_html("Hello body", None)
    assert "After Sunday" in html
