import random
from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from .models import Base, User, Event, UserRole, Rating
from .auth import get_password_hash

def seed_db():
    print("Starting database seeding...")
    # For a clean start as requested by the user, we drop and recreate
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Define users from README
        # Note: README says admin@razum.dev is Organizer role.
        # hr@razum.dev is Inspector (Observer role).
        seed_users_data = [
            ("admin@razum.dev", "password123", "Организатор (Центр Молодёжи)", UserRole.ORGANIZER),
            ("hr@razum.dev", "password123", "Инспектор HR", UserRole.OBSERVER),
            ("participant@razum.dev", "password123", "Иван Иванов", UserRole.PARTICIPANT),
            ("student1@razum.dev", "password123", "Алексей Смирнов", UserRole.PARTICIPANT),
            ("student2@razum.dev", "password123", "Мария Кузнецова", UserRole.PARTICIPANT),
            ("student3@razum.dev", "password123", "Дмитрий Соколов", UserRole.PARTICIPANT),
            ("student4@razum.dev", "password123", "Анна Попова", UserRole.PARTICIPANT),
            ("student5@razum.dev", "password123", "Михаил Лебедев", UserRole.PARTICIPANT),
            ("student6@razum.dev", "password123", "Екатерина Козлова", UserRole.PARTICIPANT),
            ("student7@razum.dev", "password123", "Сергей Новиков", UserRole.PARTICIPANT),
            ("student8@razum.dev", "password123", "Ольга Морозова", UserRole.PARTICIPANT),
            ("student9@razum.dev", "password123", "Андрей Волков", UserRole.PARTICIPANT),
        ]
        
        users_map = {}
        for email, pwd, name, role in seed_users_data:
            user = User(
                email=email,
                hashed_password=get_password_hash(pwd),
                name=name,
                role=role,
                city="Москва",
                is_verified=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            users_map[role] = user
            print(f"Created user: {email} as {role}")
            
            # Ensure rating exists for participant
            if role == UserRole.PARTICIPANT:
                points = random.randint(100, 1000)
                level = "Novice" if points < 300 else "Intermediate" if points < 700 else "Leader"
                rating = Rating(user_id=user.id, total_points=points, level=level)
                db.add(rating)
                db.commit()
        
        # Events
        organizer = users_map.get(UserRole.ORGANIZER)
        organizer_id = organizer.id if organizer else 1
        
        seed_events = [
            Event(title="Хакатон RAZUM 2.0", description="Главное событие года для разработчиков.", base_points=100, difficulty_coeff=2.0, category="IT", prizes="Грант 100k, Стажировка", organizer_id=organizer_id),
            Event(title="Форум Молодежи", description="Обсуждение стратегии развития.", base_points=50, difficulty_coeff=1.5, category="Общество", prizes="Мерч, Сертификат", organizer_id=organizer_id),
            Event(title="Эко-Сбор", description="Волонтерская акция по уборке парка.", base_points=20, difficulty_coeff=1.0, category="Волонтерство", prizes="Благодарственное письмо", organizer_id=organizer_id),
            Event(title="Лекция по AI", description="Инсайды от экспертов OpenRouter.", base_points=30, difficulty_coeff=1.2, category="Образование", prizes="Курс по ML", organizer_id=organizer_id),
        ]
        
        db.add_all(seed_events)
        db.commit()
        print("Database seeding completed successfully.")
        
    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
