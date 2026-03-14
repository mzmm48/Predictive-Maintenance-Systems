from __future__ import annotations

import pandas as pd

FAILURE_TYPE_COLS = ["TWF", "HDF", "PWF", "OSF", "RNF"]
VALID_SINGLE_LABEL_TYPES = ["TWF", "HDF", "PWF", "OSF", "RNF"]


def build_failure_type_series(df: pd.DataFrame) -> pd.Series:
    """
    Build a single failure_type label from one-hot style failure columns.
    Result labels:
      - TWF/HDF/PWF/OSF/RNF for single-label failures with Machine failure = 1
      - MULTI for >1 active failure types with Machine failure = 1
      - UNKNOWN for 0 active failure types with Machine failure = 1
      - NONE for Machine failure = 0
    """
    if "Machine failure" not in df.columns:
        raise ValueError("Column 'Machine failure' missing.")

    missing = [c for c in FAILURE_TYPE_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing failure type columns: {missing}")

    mf = df["Machine failure"].astype(int)
    type_flags = df[FAILURE_TYPE_COLS].fillna(0).astype(int)
    hits = type_flags.sum(axis=1)

    labels = pd.Series(index=df.index, dtype="object")
    labels.loc[mf == 0] = "NONE"
    labels.loc[(mf == 1) & (hits == 0)] = "UNKNOWN"
    labels.loc[(mf == 1) & (hits > 1)] = "MULTI"

    for col in FAILURE_TYPE_COLS:
        labels.loc[(mf == 1) & (hits == 1) & (type_flags[col] == 1)] = col

    return labels


def attach_failure_type(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["failure_type"] = build_failure_type_series(out)
    return out


def filter_stage2_training_rows(df_with_failure_type: pd.DataFrame) -> pd.DataFrame:
    """
    Stage-2 training rows: only true machine failures with a single, valid label.
    """
    if "failure_type" not in df_with_failure_type.columns:
        raise ValueError("Column 'failure_type' missing.")
    if "Machine failure" not in df_with_failure_type.columns:
        raise ValueError("Column 'Machine failure' missing.")

    return df_with_failure_type[
        (df_with_failure_type["Machine failure"].astype(int) == 1)
        & (df_with_failure_type["failure_type"].isin(VALID_SINGLE_LABEL_TYPES))
    ].copy()
