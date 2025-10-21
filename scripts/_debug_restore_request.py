from backend.main import create_app
from fastapi.testclient import TestClient
from backend.database import get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models.base import Base

# Setup in-memory DB similar to tests
engine = create_engine('sqlite+pysqlite:///:memory:', connect_args={'check_same_thread': False}, future=True)
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
session = SessionLocal()

app = create_app()

def override_get_db():
    yield session

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

# Create default business
client.get('/api/settings')

# Create a member
from backend.models import Business, Member
business = session.query(Business).first()
member = Member(business_id=business.id, first_name='Ada', last_name='Lovelace', email='ada@ex.com')
session.add(member)
session.commit()

# Create manual backup
resp = client.get('/api/settings/backup/manual')
archive_bytes = resp.content

# Delete member
session.delete(member)
session.commit()

# Post restore
files = {'file': ('backup.zip', archive_bytes, 'application/zip')}
resp2 = client.post('/api/backup/restore?dry_run=false', files=files)
print('status', resp2.status_code)
try:
    print('json', resp2.json())
except Exception as e:
    print('body len', len(resp2.content))
