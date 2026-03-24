from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from .models import Base, User, Event, UserRole, Rating
from .auth import get_password_hash

def seed_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Users
    users = [
        User(email="admin@razum.dev", hashed_password=get_password_hash("password123"), name="Админ", role=UserRole.ADMIN, city="Москва"),
        User(email="organizer@razum.dev", hashed_password=get_password_hash("password123"), name="Организатор", role=UserRole.ORGANIZER, city="Санкт-Петербург", is_verified=True),
        User(email="participant@razum.dev", hashed_password=get_password_hash("password123"), name="Иван Иванов", role=UserRole.PARTICIPANT, education="МГТУ им. Баумана", work_place="Аналитик", age=21, city="Казань", telegram="@ivan_razum"),
    ]
    db.add_all(users)
    db.commit()
    
    # Ratings
    for u in users:
        db.add(Rating(user_id=u.id, total_points=450 if u.role == UserRole.PARTICIPANT else 0, level="Leader" if u.role == UserRole.PARTICIPANT else "Novice"))
    db.commit()

    # Events
    events = [
        Event(title="Хакатон RAZUM 2.0", description="Главное событие года для разработчиков.", base_points=100, difficulty_coeff=2.0, category="IT", prizes="Грант 100k, Стажировка", organizer_id=users[1].id),
        Event(title="Форум Молодежи", description="Обсуждение стратегии развития.", base_points=50, difficulty_coeff=1.5, category="Общество", prizes="Мерч, Сертификат", organizer_id=users[1].id),
        Event(title="Эко-Сбор", description="Волонтерская акция по уборке парка.", base_points=20, difficulty_coeff=1.0, category="Волонтерство", prizes="Благодарственное письмо", organizer_id=users[1].id),
        Event(title="Лекция по AI", description="Инсайды от экспертов OpenRouter.", base_points=30, difficulty_coeff=1.2, category="Образование", prizes="Курс по ML", organizer_id=users[1].id),
    ]
    db.add_all(events)
    db.commit()
    db.close()

if __name__ == "__main__":
    seed_db()
