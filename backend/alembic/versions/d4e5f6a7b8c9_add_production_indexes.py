"""
Add production indexes for frequent query patterns
====================================================
Composite indexes for the five hottest query patterns identified during
production readiness review.  All are non-unique, covering filters used
in paginated list views and dashboard queries.

Revision ID: d4e5f6a7b8c9
Revises: b3c4d5e6f7g8
Create Date: 2026-07-19 16:37:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "d4e5f6a7b8c9"
down_revision = "b3c4d5e6f7g8"
branch_labels = None
depends_on = None


# ---------------------------------------------------------------------------
#  Index definitions — (index_name, table, columns)
# ---------------------------------------------------------------------------
INDEXES = [
    # 1. AnalysisHistory: history page — filtered by user_id, ordered by created_at DESC
    (
        "ix_analysis_history_user_id_created_at",
        "analysis_history",
        ["user_id", "created_at"],
    ),
    # 2. ATSScore: user's score history — join via resume_id, ordered by created_at
    #    resume_id already has a single-column index; this composite covers
    #    queries that also filter/sort by created_at.
    (
        "ix_ats_scores_resume_id_created_at",
        "ats_scores",
        ["resume_id", "created_at"],
    ),
    # 3. ResumeVersion: version list per resume — filtered by resume_id
    #    resume_id already has an index, but we add a composite with
    #    version_number for efficient ordering in "list all versions" queries.
    (
        "ix_resume_versions_resume_id_version_number",
        "resume_versions",
        ["resume_id", "version_number"],
    ),
    # 4. Candidate: recruiter shortlist — filtered by job_id + status
    (
        "ix_candidates_job_id_status",
        "candidates",
        ["job_id", "status"],
    ),
    # 5. CreditTransaction: credit history page — filtered by user_id, ordered by created_at
    (
        "ix_credit_transactions_user_id_created_at",
        "credit_transactions",
        ["user_id", "created_at"],
    ),
]


def upgrade() -> None:
    for index_name, table, columns in INDEXES:
        op.create_index(index_name, table, columns)


def downgrade() -> None:
    for index_name, table, _columns in reversed(INDEXES):
        op.drop_index(index_name, table_name=table)
