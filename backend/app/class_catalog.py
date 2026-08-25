from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ClassRule:
    label: str
    category: str
    color: str


class ClassCatalog:
    def __init__(self, rules: dict[str, ClassRule]) -> None:
        if not rules:
            raise ValueError("Class mapping must not be empty")
        self._rules = rules

    @classmethod
    def from_file(cls, path: Path) -> "ClassCatalog":
        if not path.is_file():
            raise FileNotFoundError(f"Class mapping file not found: {path}")

        with path.open("r", encoding="utf-8") as file:
            raw_data: dict[str, dict[str, Any]] = json.load(file)

        rules: dict[str, ClassRule] = {}
        for raw_class_name, values in raw_data.items():
            normalized_name = raw_class_name.strip().upper()
            rules[normalized_name] = ClassRule(
                label=str(values["label"]),
                category=str(values["category"]),
                color=str(values["color"]),
            )
        return cls(rules)

    @property
    def class_names(self) -> list[str]:
        return list(self._rules)

    @property
    def categories(self) -> set[str]:
        return {rule.category for rule in self._rules.values()}

    def items(self) -> list[tuple[str, ClassRule]]:
        return list(self._rules.items())

    def rule_for(self, raw_class_name: str) -> ClassRule:
        normalized_name = raw_class_name.strip().upper()
        try:
            return self._rules[normalized_name]
        except KeyError as exc:
            raise ValueError(
                f"No class mapping configured for: {raw_class_name}"
            ) from exc
