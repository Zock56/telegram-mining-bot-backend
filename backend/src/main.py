import os
import sys
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import asyncio
import threading

# Cargar variables de entorno (si las tienes en un .env)
# from dotenv import load_dotenv
# load_dotenv()

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "YOUR_TELEGRAM_BOT_TOKEN") # <<< ¡IMPORTANTE! Reemplaza esto con tu token real de BotFather
WEBAPP_URL = os.environ.get("WEBAPP_URL", "https://your-webapp-url.com") # URL de tu dApp

app = Flask(__name__, static_folder="/home/ubuntu/mining-dapp-frontend/dist")
app.config["SECRET_KEY"] = "asdf#FGSgvasgf$5$WGT"
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", f"sqlite:///{os.path.join(os.path.abspath(os.path.dirname(__file__)), 'database', 'app.db')}") # Usar SQLite por defecto, configurar PostgreSQL para producción
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy()
db.init_app(app)

# Definición de modelos de la base de datos
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    telegram_id = db.Column(db.BigInteger, unique=True, nullable=False)
    ton_wallet_address = db.Column(db.String(255), nullable=True)
    balance_ton = db.Column(db.Float, default=0.0)
    mining_speed = db.Column(db.Float, default=0.0) # TON por hora
    last_mine_time = db.Column(db.DateTime, nullable=True)
    referrer_id = db.Column(db.BigInteger, db.ForeignKey("user.telegram_id"), nullable=True)
    referral_link = db.Column(db.String(255), nullable=True)
    miners = db.relationship("UserMiner", backref="user", lazy=True)
    transactions = db.relationship("Transaction", backref="user", lazy=True)
    quest_progress = db.relationship("UserQuest", backref="user", lazy=True)
    referred_users = db.relationship("User", remote_side=[telegram_id], backref="referrer", lazy=True)

    def __repr__(self):
        return f"<User {self.telegram_id}>"

class Miner(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    price_ton = db.Column(db.Float, nullable=False)
    mining_speed_increase = db.Column(db.Float, nullable=False) # Aumento de TON por hora
    roi_percentage = db.Column(db.Integer, nullable=False)
    profit_days = db.Column(db.Integer, nullable=False)

    def __repr__(self):
        return f"<Miner {self.name}>"

class UserMiner(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    miner_id = db.Column(db.Integer, db.ForeignKey("miner.id"), nullable=False)
    purchase_date = db.Column(db.DateTime, default=datetime.utcnow)
    miner = db.relationship("Miner")

    def __repr__(self):
        return f"<UserMiner User:{self.user_id} Miner:{self.miner_id}>"

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    type = db.Column(db.String(50), nullable=False) # deposit, withdrawal, purchase, reward
    amount_ton = db.Column(db.Float, nullable=False)
    transaction_hash = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), default="pending") # pending, completed, failed
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Transaction {self.id} Type:{self.type} Amount:{self.amount_ton}>"

class Quest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=False)
    required_referrals = db.Column(db.Integer, nullable=True)
    reward_ton = db.Column(db.Float, nullable=False)
    type = db.Column(db.String(50), nullable=False) # referral

    def __repr__(self):
        return f"<Quest {self.name}>"

class UserQuest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    quest_id = db.Column(db.Integer, db.ForeignKey("quest.id"), nullable=False)
    status = db.Column(db.String(50), default="pending") # pending, completed, claimed
    progress = db.Column(db.Integer, default=0) # Para misiones de referidos
    quest = db.relationship("Quest")

    def __repr__(self):
        return f"<UserQuest User:{self.user_id} Quest:{self.quest_id} Status:{self.status}>"

# --- Configuración del Bot de Telegram ---
application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_telegram_id = update.effective_user.id
    username = update.effective_user.username or update.effective_user.first_name

    with app.app_context():
        user = User.query.filter_by(telegram_id=user_telegram_id).first()
        if not user:
            # Si el usuario no existe, crearlo
            referrer_telegram_id = None
            if context.args and context.args[0].isdigit():
                referrer_telegram_id = int(context.args[0])

            user = User(
                telegram_id=user_telegram_id,
                balance_ton=0.0, # Balance inicial
                mining_speed=0.0, # Velocidad inicial
                referrer_id=referrer_telegram_id,
                referral_link=f"https://t.me/{context.bot.username}?start={user_telegram_id}"
            )
            db.session.add(user)
            db.session.commit()

            # Si hay un referer, actualizar su progreso de misión
            if referrer_telegram_id:
                referrer = User.query.filter_by(telegram_id=referrer_telegram_id).first()
                if referrer:
                    for quest in Quest.query.filter_by(type="referral").all():
                        user_quest = UserQuest.query.filter_by(user_id=referrer.id, quest_id=quest.id).first()
                        if not user_quest:
                            user_quest = UserQuest(user_id=referrer.id, quest_id=quest.id, progress=0)
                            db.session.add(user_quest)
                        user_quest.progress += 1
                        if user_quest.progress >= quest.required_referrals:
                            user_quest.status = "completed"
                        db.session.commit()

        await update.message.reply_html(
            f"¡Hola {username}!\n\nBienvenido a la dApp de minería simulada. Puedes acceder a la dApp aquí: <a href=\"{WEBAPP_URL}\">Abrir dApp</a>",
        )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text("Usa /start para iniciar la dApp de minería.")

# --- Rutas de la API para el Frontend ---
@app.route("/api/user/<int:telegram_id>", methods=["GET"])
def get_user_data(telegram_id):
    with app.app_context():
        user = User.query.filter_by(telegram_id=telegram_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Obtener el minero activo del usuario
        active_miner = None
        if user.miners:
            # Asumimos que el usuario solo puede tener un minero activo a la vez, o el último comprado
            user_miner = UserMiner.query.filter_by(user_id=user.id).order_by(UserMiner.purchase_date.desc()).first()
            if user_miner:
                active_miner = {
                    "id": user_miner.miner.id,
                    "name": user_miner.miner.name,
                    "price": user_miner.miner.price_ton,
                    "miningSpeed": user_miner.miner.mining_speed_increase,
                    "roi": user_miner.miner.roi_percentage,
                    "profitDays": user_miner.miner.profit_days
                }

        # Obtener progreso de misiones
        user_quests_data = []
        for uq in user.quest_progress:
            user_quests_data.append({
                "id": uq.quest.id,
                "name": uq.quest.name,
                "description": uq.quest.description,
                "requiredReferrals": uq.quest.required_referrals,
                "reward": uq.quest.reward_ton,
                "progress": uq.progress,
                "status": uq.status
            })

        # Obtener número de referidos
        referral_count = User.query.filter_by(referrer_id=telegram_id).count()

        return jsonify({
            "telegramId": user.telegram_id,
            "balance": user.balance_ton,
            "miningSpeed": user.mining_speed,
            "miner": active_miner,
            "isMining": user.last_mine_time is not None and (datetime.utcnow() - user.last_mine_time).total_seconds() < (4 * 3600),
            "lastMineTime": user.last_mine_time.isoformat() if user.last_mine_time else None,
            "referralLink": user.referral_link,
            "walletAddress": user.ton_wallet_address,
            "quests": user_quests_data,
            "referralCount": referral_count
        })

@app.route("/api/miners", methods=["GET"])
def get_miners():
    with app.app_context():
        miners = Miner.query.all()
        return jsonify([
            {
                "id": m.id,
                "name": m.name,
                "price": m.price_ton,
                "miningSpeed": m.mining_speed_increase,
                "roi": m.roi_percentage,
                "profitDays": m.profit_days
            } for m in miners
        ])

@app.route("/api/mine/start", methods=["POST"])
def start_mining():
    data = request.get_json()
    telegram_id = data.get("telegramId")

    with app.app_context():
        user = User.query.filter_by(telegram_id=telegram_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        if not user.miners:
            return jsonify({"error": "User has no miner"}), 400

        # Verificar si ya está minando o si el tiempo de minado no ha terminado
        if user.last_mine_time and (datetime.utcnow() - user.last_mine_time).total_seconds() < (4 * 3600):
            return jsonify({"error": "Already mining or cooldown active"}), 400

        user.last_mine_time = datetime.utcnow()
        db.session.commit()
        return jsonify({"message": "Mining started", "lastMineTime": user.last_mine_time.isoformat()})

@app.route("/api/mine/claim", methods=["POST"])
def claim_mining_rewards():
    data = request.get_json()
    telegram_id = data.get("telegramId")

    with app.app_context():
        user = User.query.filter_by(telegram_id=telegram_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        if not user.miners:
            return jsonify({"error": "User has no miner"}), 400

        if not user.last_mine_time:
            return jsonify({"error": "Mining not started"}), 400

        elapsed_time = (datetime.utcnow() - user.last_mine_time).total_seconds()
        four_hours_seconds = 4 * 3600

        if elapsed_time < four_hours_seconds:
            return jsonify({"error": "Mining not completed yet"}), 400
        
        # Calcular ganancias
        user_miner = UserMiner.query.filter_by(user_id=user.id).order_by(UserMiner.purchase_date.desc()).first()
        if not user_miner:
             return jsonify({"error": "User has no miner"}), 400

        earnings = user_miner.miner.mining_speed_increase * 4
        user.balance_ton += earnings
        user.last_mine_time = None # Resetear para el próximo ciclo
        db.session.add(Transaction(user_id=user.id, type="mining_reward", amount_ton=earnings, status="completed"))
        db.session.commit()
        return jsonify({"message": "Rewards claimed", "newBalance": user.balance_ton, "earnings": earnings})

@app.route("/api/shop/buy_miner", methods=["POST"])
def buy_miner():
    data = request.get_json()
    telegram_id = data.get("telegramId")
    miner_id = data.get("minerId")

    with app.app_context():
        user = User.query.filter_by(telegram_id=telegram_id).first()
        miner = Miner.query.get(miner_id)

        if not user or not miner:
            return jsonify({"error": "User or Miner not found"}), 404

        if user.balance_ton < miner.price_ton:
            return jsonify({"error": "Insufficient funds"}), 400
        
        # Si ya tiene un minero, se reemplaza la velocidad de minado
        # Para simplificar, asumimos que solo se puede tener un minero activo a la vez
        if user.miners:
            # Eliminar minero anterior o simplemente actualizar la velocidad
            # Aquí se podría implementar un sistema de mejora o múltiples mineros
            pass # Por ahora, solo actualizamos la velocidad y el minero asociado

        user.balance_ton -= miner.price_ton
        user.mining_speed = miner.mining_speed_increase # Actualizar velocidad de minado
        db.session.add(UserMiner(user_id=user.id, miner_id=miner.id))
        db.session.add(Transaction(user_id=user.id, type="purchase", amount_ton=-miner.price_ton, status="completed"))
        db.session.commit()
        return jsonify({"message": f"Miner {miner.name} purchased", "newBalance": user.balance_ton, "newMiningSpeed": user.mining_speed})

@app.route("/api/quests/claim", methods=["POST"])
def claim_quest_reward():
    data = request.get_json()
    telegram_id = data.get("telegramId")
    quest_id = data.get("questId")

    with app.app_context():
        user = User.query.filter_by(telegram_id=telegram_id).first()
        quest = Quest.query.get(quest_id)

        if not user or not quest:
            return jsonify({"error": "User or Quest not found"}), 404
        
        user_quest = UserQuest.query.filter_by(user_id=user.id, quest_id=quest.id).first()

        if not user_quest or user_quest.status != "completed":
            return jsonify({"error": "Quest not completed or not found for user"}), 400
        
        if user_quest.status == "claimed":
            return jsonify({"error": "Quest already claimed"}), 400

        user.balance_ton += quest.reward_ton
        user_quest.status = "claimed"
        db.session.add(Transaction(user_id=user.id, type="quest_reward", amount_ton=quest.reward_ton, status="completed"))
        db.session.commit()
        return jsonify({"message": "Quest reward claimed", "newBalance": user.balance_ton})

@app.route("/api/wallet/deposit", methods=["POST"])
def record_deposit():
    data = request.get_json()
    telegram_id = data.get("telegramId")
    amount = data.get("amount")

    if not telegram_id or not amount:
        return jsonify({"error": "Missing telegramId or amount"}), 400

    with app.app_context():
        user = User.query.filter_by(telegram_id=telegram_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        user.balance_ton += float(amount)
        db.session.add(Transaction(user_id=user.id, type="deposit", amount_ton=float(amount), status="completed"))
        db.session.commit()
        return jsonify({"message": "Deposit recorded", "newBalance": user.balance_ton})

@app.route("/api/wallet/withdraw", methods=["POST"])
def request_withdrawal():
    data = request.get_json()
    telegram_id = data.get("telegramId")
    amount = data.get("amount")
    wallet_address = data.get("walletAddress")

    if not telegram_id or not amount or not wallet_address:
        return jsonify({"error": "Missing telegramId, amount or walletAddress"}), 400

    min_withdrawal = 3.0
    fee = 0.1 # Ejemplo de fee

    with app.app_context():
        user = User.query.filter_by(telegram_id=telegram_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        if float(amount) < min_withdrawal:
            return jsonify({"error": f"Minimum withdrawal amount is {min_withdrawal} TON"}), 400

        total_amount_needed = float(amount) + fee
        if user.balance_ton < total_amount_needed:
            return jsonify({"error": "Insufficient funds"}), 400

        # Aquí se simularía el envío de TON a la dirección de la wallet
        # En un entorno real, esto implicaría interactuar con la blockchain de TON
        user.balance_ton -= total_amount_needed
        db.session.add(Transaction(user_id=user.id, type="withdrawal", amount_ton=-float(amount), transaction_hash="simulated_hash", status="pending"))
        db.session.commit()
        return jsonify({"message": "Withdrawal requested", "newBalance": user.balance_ton, "fee": fee})

@app.route("/api/wallet/connect", methods=["POST"])
def connect_wallet():
    data = request.get_json()
    telegram_id = data.get("telegramId")
    wallet_address = data.get("walletAddress")

    if not telegram_id or not wallet_address:
        return jsonify({"error": "Missing telegramId or walletAddress"}), 400

    with app.app_context():
        user = User.query.filter_by(telegram_id=telegram_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        user.ton_wallet_address = wallet_address
        db.session.commit()
        return jsonify({"message": "Wallet connected", "walletAddress": user.ton_wallet_address})

@app.route("/api/wallet/disconnect", methods=["POST"])
def disconnect_wallet():
    data = request.get_json()
    telegram_id = data.get("telegramId")

    if not telegram_id:
        return jsonify({"error": "Missing telegramId"}), 400

    with app.app_context():
        user = User.query.filter_by(telegram_id=telegram_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        user.ton_wallet_address = None
        db.session.commit()
        return jsonify({"message": "Wallet disconnected"})

# Servir el frontend React
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    # Esto solo se ejecuta si el script se corre directamente
    # Para despliegue en producción, se usaría un WSGI server como Gunicorn
    # Asegurarse de que la aplicación de Telegram se inicialice antes de ejecutar el servidor Flask
    with app.app_context():
        db.create_all()
        # Insertar mineros si no existen
        if not Miner.query.first():
            miners_data = [
                {"name": "Minero Básico", "price_ton": 1, "mining_speed_increase": 0.00167, "roi_percentage": 120, "profit_days": 30},
                {"name": "Minero Avanzado", "price_ton": 5, "mining_speed_increase": 0.00833, "roi_percentage": 120, "profit_days": 30},
                {"name": "Minero Pro", "price_ton": 10, "mining_speed_increase": 0.0167, "roi_percentage": 120, "profit_days": 30},
                {"name": "Minero Elite", "price_ton": 25, "mining_speed_increase": 0.0417, "roi_percentage": 120, "profit_days": 30},
                {"name": "Minero Master", "price_ton": 50, "mining_speed_increase": 0.0833, "roi_percentage": 120, "profit_days": 30},
                {"name": "Minero Legendary", "price_ton": 100, "mining_speed_increase": 0.167, "roi_percentage": 120, "profit_days": 30}
            ]
            for m_data in miners_data:
                db.session.add(Miner(**m_data))
            db.session.commit()

        # Insertar misiones si no existen
        if not Quest.query.first():
            quests_data = [
                {"name": "Invita a 3 amigos", "description": "Invita a 3 personas usando tu link de referido", "required_referrals": 3, "reward_ton": 0.003, "type": "referral"},
                {"name": "Invita a 5 amigos", "description": "Invita a 5 personas usando tu link de referido", "required_referrals": 5, "reward_ton": 0.005, "type": "referral"},
                {"name": "Invita a 10 amigos", "description": "Invita a 10 personas usando tu link de referido", "required_referrals": 10, "reward_ton": 0.010, "type": "referral"},
                {"name": "Invita a 100 amigos", "description": "Invita a 100 personas usando tu link de referido", "required_referrals": 100, "reward_ton": 0.100, "type": "referral"}
            ]
            for q_data in quests_data:
                db.session.add(Quest(**q_data))
            db.session.commit()

        # Iniciar el polling del bot de Telegram en un hilo separado para desarrollo local
        if TELEGRAM_BOT_TOKEN != "YOUR_TELEGRAM_BOT_TOKEN":
            async def run_bot_polling():
                await application.initialize()
                application.add_handler(CommandHandler("start", start_command))
                application.add_handler(CommandHandler("help", help_command))
                await application.run_polling()

            threading.Thread(target=lambda: asyncio.run(run_bot_polling()), daemon=True).start()
        else:
            print("ADVERTENCIA: El token del bot de Telegram no ha sido configurado. Los comandos del bot no funcionarán.")

    app.run(debug=True, host="0.0.0.0", port=5000)

