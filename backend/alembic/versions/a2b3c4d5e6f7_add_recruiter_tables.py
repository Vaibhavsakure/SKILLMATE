"""add_recruiter_tables

Revision ID: a2b3c4d5e6f7
Revises: 1637d19cd539
Create Date: 2026-05-24 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = '1637d19cd539'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- RecruiterJob table ---
    op.create_table(
        'recruiter_jobs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hr_user_id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('company_name', sa.String(length=200), nullable=True),
        sa.Column('jd_text', sa.Text(), nullable=False),
        sa.Column('required_skills', sa.Text(), nullable=True),
        sa.Column('experience_level', sa.String(length=50), nullable=True),
        sa.Column('score_threshold', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('calendly_link', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('recruiter_jobs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_recruiter_jobs_hr_user_id'), ['hr_user_id'], unique=False)

    # --- Candidate table ---
    op.create_table(
        'candidates',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('job_id', sa.String(), nullable=False),
        sa.Column('applicant_user_id', sa.String(length=36), nullable=True),
        sa.Column('applicant_name', sa.String(length=200), nullable=True),
        sa.Column('applicant_email', sa.String(length=200), nullable=True),
        sa.Column('cv_text', sa.Text(), nullable=False),
        sa.Column('cv_filename', sa.String(length=300), nullable=True),
        sa.Column('overall_score', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('skills_match', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('experience_fit', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('red_flags', sa.Text(), nullable=True),
        sa.Column('green_flags', sa.Text(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('recommendation', sa.String(length=20), nullable=True, server_default="'pending'"),
        sa.Column('status', sa.String(length=20), nullable=False, server_default="'pending'"),
        sa.Column('source', sa.String(length=20), nullable=False, server_default="'upload'"),
        sa.Column('applied_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['job_id'], ['recruiter_jobs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('candidates', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_candidates_job_id'), ['job_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_candidates_applicant_user_id'), ['applicant_user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('candidates', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_candidates_applicant_user_id'))
        batch_op.drop_index(batch_op.f('ix_candidates_job_id'))
    op.drop_table('candidates')

    with op.batch_alter_table('recruiter_jobs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_recruiter_jobs_hr_user_id'))
    op.drop_table('recruiter_jobs')
