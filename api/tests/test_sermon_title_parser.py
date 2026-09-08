import asyncio

from app.services.sermon_title_parser import (
    MockSermonTitleParser,
    _normalize_result,
    _regex_fallback,
    parse_title_with_fallback,
    strip_honorific,
)


def test_strip_honorific():
    assert strip_honorific("Pastor P.J. Tibayan") == "P.J. Tibayan"
    assert strip_honorific("Pastor PJ Tibayan") == "PJ Tibayan"
    assert strip_honorific("Rev. John Smith") == "John Smith"
    assert strip_honorific("Reverend Jane Doe") == "Jane Doe"
    assert strip_honorific("Dr. Sam Chun") == "Sam Chun"
    assert strip_honorific("DJ Jansson") == "DJ Jansson"
    assert strip_honorific("  Pastor  Nate Miguel  ") == "Nate Miguel"
    assert strip_honorific("") == ""
    assert strip_honorific(None) == ""


def test_regex_fallback_detects_passage():
    result = _regex_fallback("Philippians 1:12-18 - DJ Jansson")
    assert result == {
        "title": "Philippians 1:12-18 - DJ Jansson",
        "preacher": None,
        # The regex captures chapter:verse (not the full range) — one of the
        # reasons AI is the primary parser.
        "scripture_reference": "Philippians 1:12",
        "is_sermon": True,
    }


def test_regex_fallback_misses_compact_passage():
    # A known regex blind spot — exactly why AI is the primary parser.
    result = _regex_fallback(
        "The Good News Must Be Proclaimed, Isaiah40:1-11 - Bryan Winchester"
    )
    assert result["scripture_reference"] is None


def test_normalize_result_fills_missing_title_with_passage():
    result = _normalize_result(
        {
            "title": "",
            "preacher": "Pastor DJ Jansson",
            "scripture_reference": "Philippians 1:12-18",
            "is_sermon": True,
        },
        "Philippians 1:12-18 - DJ Jansson",
    )
    assert result["title"] == "Philippians 1:12-18"
    assert result["preacher"] == "DJ Jansson"


def test_normalize_result_coerces_string_boolean():
    result = _normalize_result(
        {"title": "T", "preacher": None, "scripture_reference": None, "is_sermon": "false"},
        "T",
    )
    assert result["is_sermon"] is False


def test_normalize_result_handles_missing_keys():
    result = _normalize_result({}, "Raw Title")
    assert result == {
        "title": "Raw Title",
        "preacher": None,
        "scripture_reference": None,
        "is_sermon": False,
    }


def test_parse_title_with_fallback_none_parser():
    result = parse_title_with_fallback("Philippians 1:12-18 - DJ Jansson", None)
    assert result["scripture_reference"] == "Philippians 1:12"
    assert result["preacher"] is None


class FailingParser:
    async def parse(self, title):
        raise RuntimeError("LLM down")


def test_parse_title_with_fallback_on_failure():
    result = parse_title_with_fallback("Philippians 1:12-18 - DJ Jansson", FailingParser())
    assert result["scripture_reference"] == "Philippians 1:12"
    assert result["title"] == "Philippians 1:12-18 - DJ Jansson"
    assert result["is_sermon"] is True


def test_mock_parser_is_deterministic():
    parser = MockSermonTitleParser()
    result = asyncio.run(parser.parse("Philippians 1:12-18 - DJ Jansson"))
    assert result["scripture_reference"] == "Philippians 1:12"
    assert result["title"] == "Philippians 1:12-18 - DJ Jansson"