import os
from contextlib import contextmanager

import psycopg2
from dotenv import load_dotenv


load_dotenv()


def get_dsn() -> str:
    dsn = os.getenv("DATABASE_URL", "").strip()
    if not dsn:
        raise ValueError("DATABASE_URL is required")
    return dsn


@contextmanager
def get_connection():
    conn = psycopg2.connect(get_dsn())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
