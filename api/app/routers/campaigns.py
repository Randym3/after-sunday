import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user_uuid
from app.db import get_db
from app.models.campaign import Campaign, CampaignMember
from app.models.group import Group, GroupMember
from app.models.member import Member
from app.models.sermon import Sermon
from app.schemas.campaign import BulkDeleteRequest, CampaignCreate, CampaignRead, CampaignUpdate

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _to_read(db: Session, campaign: Campaign) -> CampaignRead:
    if campaign.recipient_source == "group" and campaign.group_id:
        count = db.scalar(select(func.count()).select_from(GroupMember).where(GroupMember.group_id == campaign.group_id)) or 0
    else:
        count = db.scalar(select(func.count()).select_from(CampaignMember).where(CampaignMember.campaign_id == campaign.id)) or 0
    return CampaignRead(
        id=campaign.id, name=campaign.name, subject=campaign.subject, body=campaign.body,
        sermon_id=campaign.sermon_id,
        sermon_title=db.scalar(select(Sermon.title).where(Sermon.id == campaign.sermon_id)) if campaign.sermon_id else None,
        recipient_source=campaign.recipient_source, group_id=campaign.group_id,
        recipient_count=count, status=campaign.status,
        send_at=campaign.send_at,
        created_at=campaign.created_at, updated_at=campaign.updated_at,
    )


@router.post("", response_model=CampaignRead, status_code=201)
def create_campaign(payload: CampaignCreate, db: Session = Depends(get_db), _user: uuid.UUID = Depends(get_current_user_uuid)):
    sermon = db.get(Sermon, payload.sermon_id)
    if sermon is None:
        raise HTTPException(status_code=404, detail="Sermon not found")
    if not sermon.follow_up_subject or not sermon.follow_up_body:
        raise HTTPException(status_code=409, detail="Needs email draft")

    if payload.group_id is not None:
        if db.get(Group, payload.group_id) is None:
            raise HTTPException(status_code=404, detail="Group not found")
        group_member_count = db.scalar(select(func.count()).select_from(GroupMember).where(GroupMember.group_id == payload.group_id)) or 0
        if group_member_count == 0:
            raise HTTPException(status_code=400, detail="This group has no members")
        recipient_source = "group"
        member_ids: set[uuid.UUID] = set()
    else:
        member_ids = set(db.scalars(select(Member.id).where(Member.id.in_(payload.member_ids))).all())
        if not member_ids:
            raise HTTPException(status_code=400, detail="No valid members were selected")
        recipient_source = "members"

    campaign = Campaign(
        created_by_user_id=_user, name=payload.name.strip(),
        subject=payload.subject.strip() if payload.subject else sermon.follow_up_subject,
        body=payload.body if payload.body is not None else sermon.follow_up_body,
        recipient_source=recipient_source, group_id=payload.group_id, sermon_id=sermon.id,
        send_at=payload.send_at,
    )
    db.add(campaign)
    db.flush()
    for member_id in member_ids:
        db.add(CampaignMember(campaign_id=campaign.id, member_id=member_id))
    db.commit()
    db.refresh(campaign)
    return _to_read(db, campaign)


@router.get("", response_model=list[CampaignRead])
def list_campaigns(db: Session = Depends(get_db), _user: uuid.UUID = Depends(get_current_user_uuid)):
    campaigns = db.scalars(select(Campaign).order_by(Campaign.created_at.desc())).all()
    return [_to_read(db, campaign) for campaign in campaigns]


@router.post("/bulk-delete", response_model=dict)
def bulk_delete_campaigns(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    campaigns = db.scalars(
        select(Campaign).where(Campaign.id.in_(payload.ids))
    ).all()
    for campaign in campaigns:
        db.delete(campaign)
    db.commit()
    return {"deleted": len(campaigns)}


@router.get("/{campaign_id}", response_model=CampaignRead)
def get_campaign(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return _to_read(db, campaign)


@router.patch("/{campaign_id}", response_model=CampaignRead)
def update_campaign(
    campaign_id: uuid.UUID,
    payload: CampaignUpdate,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    data = payload.model_dump(exclude_unset=True)

    if data.get("name") is not None:
        data["name"] = data["name"].strip()
    if data.get("subject") is not None:
        data["subject"] = data["subject"].strip() or None

    for field, value in data.items():
        setattr(campaign, field, value)

    db.commit()
    db.refresh(campaign)
    return _to_read(db, campaign)


@router.delete("/{campaign_id}", response_model=CampaignRead)
def delete_campaign(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(campaign)
    db.commit()
    return _to_read(db, campaign)


@router.get("/{campaign_id}/recipients", response_model=list[dict])
def list_campaign_recipients(campaign_id: uuid.UUID, db: Session = Depends(get_db), _user: uuid.UUID = Depends(get_current_user_uuid)):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    query = select(Member).join(
        GroupMember if campaign.recipient_source == "group" else CampaignMember,
        (GroupMember.member_id == Member.id) if campaign.recipient_source == "group" else (CampaignMember.member_id == Member.id),
    )
    if campaign.recipient_source == "group":
        query = query.where(GroupMember.group_id == campaign.group_id)
    else:
        query = query.where(CampaignMember.campaign_id == campaign.id)
    members = db.scalars(query.order_by(Member.last_name, Member.first_name)).all()
    return [{"id": m.id, "firstName": m.first_name, "lastName": m.last_name, "email": m.email} for m in members]
