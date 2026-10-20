from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import Access, get_current_user, get_owned, workspace_admin, workspace_member
from ..database import get_db
from ..models import Animal, User
from ..schemas import AnimalIn, AnimalOut

router = APIRouter(tags=["animals"])

DUPLICATE_TAG = "An animal with this tag ID already exists"


@router.get("/workspaces/{workspace_id}/animals", response_model=list[AnimalOut])
def list_animals(access: Access = Depends(workspace_member), db: Session = Depends(get_db)):
    return db.scalars(
        select(Animal).where(Animal.workspace_id == access.workspace.id).order_by(Animal.tag_id)
    ).all()


@router.post("/workspaces/{workspace_id}/animals", response_model=AnimalOut, status_code=status.HTTP_201_CREATED)
def create_animal(body: AnimalIn, access: Access = Depends(workspace_admin), db: Session = Depends(get_db)):
    animal = Animal(workspace_id=access.workspace.id, **body.model_dump())
    db.add(animal)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE_TAG)
    return animal


@router.get("/animals/{animal_id}", response_model=AnimalOut)
def get_animal(animal_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_owned(db, Animal, animal_id, user)[0]


@router.put("/animals/{animal_id}", response_model=AnimalOut)
def update_animal(
    animal_id: int, body: AnimalIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    animal, _ = get_owned(db, Animal, animal_id, user, admin=True)
    for k, v in body.model_dump().items():
        setattr(animal, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE_TAG)
    return animal


@router.delete("/animals/{animal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_animal(animal_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    animal, _ = get_owned(db, Animal, animal_id, user, admin=True)
    db.delete(animal)
    db.commit()
