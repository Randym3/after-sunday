from app.services.email import render_test_email_html


def test_html_uses_org_name_escaped():
    html = render_test_email_html("Hello body", "Grace <Church>")
    assert "Grace &lt;Church&gt;" in html
    assert "Hello body" in html


def test_html_defaults_to_after_sunday():
    html = render_test_email_html("Hello body", None)
    assert "After Sunday" in html


def test_html_renders_subject_and_fixed_sections():
    html = render_test_email_html(
        "Dear member,\n\nA summary.\n\n"
        "Three takeaways:\n\n"
        "1. First takeaway.\n2. Second takeaway.\n3. Third takeaway.\n\n"
        "Reflection questions:\n\n"
        "1. First question?\n2. Second question?\n3. Third question?",
        "Grace Church",
        "A thought from Sunday",
    )
    assert "A thought from Sunday" in html
    assert "Three takeaways</p>" in html
    assert "Reflection questions</p>" in html
    assert html.count("<ol") == 2
    assert "<li" in html
    assert "<p" in html
    assert "background:#edf3ff" in html
    assert "border:1px dashed #cbd5e1" in html


def test_html_escapes_ai_text_and_subject():
    html = render_test_email_html(
        "<script>alert('x')</script>",
        "Grace Church",
        "<unsafe subject>",
    )
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "&lt;unsafe subject&gt;" in html


def test_html_embeds_logo_data_uri():
    html = render_test_email_html(
        "Hello body",
        "Grace Church",
        logo_data_uri="data:image/png;base64,ZmFrZQ==",
    )
    assert 'src="data:image/png;base64,ZmFrZQ=="' in html


def test_html_renders_four_takeaways_heading():
    html = render_test_email_html(
        "A summary.\n\n"
        "Four takeaways:\n\n"
        "1. Don't be afraid to ask for directions.\n"
        "2. Don't forget to pick up the kids.\n"
        "3. Share the road.\n"
        "4. Stay in your lane.",
        "Grace Church",
        "A thought from Sunday",
    )
    assert "Four takeaways</p>" in html
    assert "background:#edf3ff" in html
    assert html.count("<li") == 4


def test_html_ignores_unknown_takeaway_counts():
    # "Fifty takeaways" is not a valid heading and should render as text.
    html = render_test_email_html("Fifty takeaways:\n\n1. Nope.", "Grace Church")
    assert "Fifty takeaways:" in html
    assert "background:#edf3ff" not in html
