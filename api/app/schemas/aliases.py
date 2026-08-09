def to_camel(value: str) -> str:
    head, *rest = value.split("_")
    return head + "".join(word.capitalize() for word in rest)
