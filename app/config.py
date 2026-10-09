from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    odoo_url: str = ""
    odoo_db: str = ""
    odoo_api_key: str = ""
    webhook_token: str = ""
    db_path: str = "helpdesk.db"


settings = Settings()
