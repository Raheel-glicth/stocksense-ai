from pydantic import BaseModel
from typing import List

class HealthResponse(BaseModel):
    status: str
    version: str
    models_loaded: List[str]

print("OK")