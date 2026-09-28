"""Single source of "today" so date-dependent logic is testable."""

from datetime import date


def today() -> date:
    return date.today()
