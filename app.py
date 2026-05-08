import os
from datetime import datetime
from functools import wraps

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
)
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_login import (
    LoginManager,
    UserMixin,
    current_user,
    login_required,
    login_user,
    logout_user,
)
from flask_socketio import (
    SocketIO,
    emit,
    join_room,
    leave_room,
)
from flask_sqlalchemy import SQLAlchemy

load_dotenv()

app = Flask(__name__)

app.config["SECRET_KEY"] = os.getenv(
    "SECRET_KEY"
)

app.config[
    "SQLALCHEMY_DATABASE_URI"
] = os.getenv("DATABASE_URL")

app.config[
    "SQLALCHEMY_TRACK_MODIFICATIONS"
] = False

db = SQLAlchemy(app)

bcrypt = Bcrypt(app)

login_manager = LoginManager(app)

login_manager.login_view = "login_page"

CORS(app)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
)


class User(
    db.Model,
    UserMixin,
):
    __tablename__ = "users"

    id = db.Column(
        db.Integer,
        primary_key=True,
    )

    username = db.Column(
        db.String(80),
        unique=True,
        nullable=False,
    )

    email = db.Column(
        db.String(120),
        unique=True,
        nullable=False,
    )

    password_hash = db.Column(
        db.String(255),
        nullable=False,
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    tasks = db.relationship(
        "Task",
        backref="owner",
        lazy=True,
        cascade="all, delete-orphan",
    )

    def set_password(
        self,
        password,
    ):
        self.password_hash = (
            bcrypt
            .generate_password_hash(
                password
            )
            .decode("utf-8")
        )

    def check_password(
        self,
        password,
    ):
        return bcrypt.check_password_hash(
            self.password_hash,
            password,
        )

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
        }


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(
        db.Integer,
        primary_key=True,
    )

    title = db.Column(
        db.String(200),
        nullable=False,
    )

    description = db.Column(
        db.Text,
        nullable=False,
        default="",
    )

    priority = db.Column(
        db.String(20),
        nullable=False,
        default="medium",
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="pending",
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
    )

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "priority": self.priority,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "user_id": self.user_id,
        }


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(
        int(user_id)
    )


def api_login_required(
    function,
):
    @wraps(function)
    def decorated(
        *args,
        **kwargs,
    ):
        if not current_user.is_authenticated:
            return jsonify({
                "error": "Authentication required"
            }), 401

        return function(
            *args,
            **kwargs,
        )

    return decorated


def compute_analytics(
    user_id,
):
    tasks = Task.query.filter_by(
        user_id=user_id
    ).all()

    if not tasks:
        return {
            "total": 0,
            "completed": 0,
            "pending": 0,
            "in_progress": 0,
            "completion_pct": 0.0,
            "priority_breakdown": {
                "low": 0,
                "medium": 0,
                "high": 0,
            },
            "avg_tasks_per_day": 0.0,
        }

    records = [
        task.to_dict()
        for task in tasks
    ]

    dataframe = pd.DataFrame(
        records
    )

    total = int(
        len(dataframe)
    )

    completed = int(
        (
            dataframe["status"]
            == "completed"
        ).sum()
    )

    pending = int(
        (
            dataframe["status"]
            == "pending"
        ).sum()
    )

    in_progress = int(
        (
            dataframe["status"]
            == "in_progress"
        ).sum()
    )

    completion_pct = float(
        np.round(
            (
                completed
                / total
            ) * 100,
            2,
        )
    ) if total else 0.0

    priority_breakdown = (
        dataframe["priority"]
        .value_counts()
        .to_dict()
    )

    priority_breakdown = {
        priority: int(
            priority_breakdown.get(
                priority,
                0,
            )
        )
        for priority in (
            "low",
            "medium",
            "high",
        )
    }

    dataframe[
        "created_at"
    ] = pd.to_datetime(
        dataframe["created_at"]
    )

    days_span = max(
        (
            dataframe[
                "created_at"
            ].max()
            - dataframe[
                "created_at"
            ].min()
        ).days,
        1,
    )

    avg_tasks_per_day = float(
        np.round(
            total / days_span,
            2,
        )
    )

    return {
        "total": total,
        "completed": completed,
        "pending": pending,
        "in_progress": in_progress,
        "completion_pct": completion_pct,
        "priority_breakdown": priority_breakdown,
        "avg_tasks_per_day": avg_tasks_per_day,
    }


@app.route("/")
def index():
    if current_user.is_authenticated:
        return redirect(
            url_for(
                "dashboard"
            )
        )

    return redirect(
        url_for(
            "login_page"
        )
    )


@app.route("/login")
def login_page():
    if current_user.is_authenticated:
        return redirect(
            url_for(
                "dashboard"
            )
        )

    return render_template(
        "auth.html",
        mode="login",
    )


@app.route("/register")
def register_page():
    if current_user.is_authenticated:
        return redirect(
            url_for(
                "dashboard"
            )
        )

    return render_template(
        "auth.html",
        mode="register",
    )


@app.route("/dashboard")
@login_required
def dashboard():
    return render_template(
        "dashboard.html",
        user=current_user,
    )


@app.route(
    "/api/auth/register",
    methods=["POST"],
)
def register():
    data = (
        request.get_json()
        or {}
    )

    username = (
        data.get(
            "username",
            "",
        )
        .strip()
    )

    email = (
        data.get(
            "email",
            "",
        )
        .strip()
        .lower()
    )

    password = data.get(
        "password",
        "",
    )

    if (
        not username
        or not email
        or not password
    ):
        return jsonify({
            "error": "All fields are required"
        }), 400

    if len(password) < 6:
        return jsonify({
            "error": "Password must be at least 6 characters"
        }), 400

    existing_username = (
        User.query.filter_by(
            username=username
        ).first()
    )

    if existing_username:
        return jsonify({
            "error": "Username already exists"
        }), 409

    existing_email = (
        User.query.filter_by(
            email=email
        ).first()
    )

    if existing_email:
        return jsonify({
            "error": "Email already registered"
        }), 409

    user = User(
        username=username,
        email=email,
    )

    user.set_password(
        password
    )

    db.session.add(user)

    db.session.commit()

    login_user(user)

    return jsonify({
        "message": "Registration successful",
        "user": user.to_dict(),
    }), 201


@app.route(
    "/api/auth/login",
    methods=["POST"],
)
def login():
    data = (
        request.get_json()
        or {}
    )

    username = (
        data.get(
            "username",
            "",
        )
        .strip()
    )

    password = data.get(
        "password",
        "",
    )

    user = User.query.filter_by(
        username=username
    ).first()

    if (
        not user
        or not user.check_password(
            password
        )
    ):
        return jsonify({
            "error": "Invalid credentials"
        }), 401

    login_user(user)

    return jsonify({
        "message": "Login successful",
        "user": user.to_dict(),
    })


@app.route(
    "/api/auth/logout",
    methods=["POST"],
)
@login_required
def logout():
    logout_user()

    return jsonify({
        "message": "Logout successful"
    })


@app.route(
    "/api/tasks",
    methods=["GET"],
)
@api_login_required
def get_tasks():
    status = request.args.get(
        "status"
    )

    priority = request.args.get(
        "priority"
    )

    query = Task.query.filter_by(
        user_id=current_user.id
    )

    if status:
        query = query.filter_by(
            status=status
        )

    if priority:
        query = query.filter_by(
            priority=priority
        )

    tasks = (
        query.order_by(
            Task.created_at.desc()
        ).all()
    )

    return jsonify({
        "tasks": [
            task.to_dict()
            for task in tasks
        ]
    })


@app.route(
    "/api/tasks",
    methods=["POST"],
)
@api_login_required
def add_task():
    data = (
        request.get_json()
        or {}
    )

    title = (
        data.get(
            "title",
            "",
        )
        .strip()
    )

    description = (
        data.get(
            "description",
            "",
        )
        .strip()
    )

    priority = data.get(
        "priority",
        "medium",
    )

    status = data.get(
        "status",
        "pending",
    )

    if not title:
        return jsonify({
            "error": "Title is required"
        }), 400

    if priority not in (
        "low",
        "medium",
        "high",
    ):
        return jsonify({
            "error": "Priority must be low, medium, or high"
        }), 400

    if status not in (
        "pending",
        "in_progress",
        "completed",
    ):
        return jsonify({
            "error": "Invalid status"
        }), 400

    task = Task(
        title=title,
        description=description,
        priority=priority,
        status=status,
        user_id=current_user.id,
    )

    db.session.add(task)

    db.session.commit()

    analytics = (
        compute_analytics(
            current_user.id
        )
    )

    socketio.emit(
        "task_added",
        {
            "task": task.to_dict(),
            "analytics": analytics,
        },
        room=f"user_{current_user.id}",
    )

    return jsonify({
        "message": "Task created successfully",
        "task": task.to_dict(),
    }), 201


@app.route(
    "/api/tasks/<int:task_id>",
    methods=["PUT"],
)
@api_login_required
def update_task(
    task_id,
):
    task = Task.query.filter_by(
        id=task_id,
        user_id=current_user.id,
    ).first()

    if not task:
        return jsonify({
            "error": "Task not found"
        }), 404

    data = (
        request.get_json()
        or {}
    )

    if "title" in data:
        task.title = (
            data["title"]
            .strip()
            or task.title
        )

    if "description" in data:
        task.description = data[
            "description"
        ]

    if (
        "priority" in data
        and data["priority"] in (
            "low",
            "medium",
            "high",
        )
    ):
        task.priority = data[
            "priority"
        ]

    if (
        "status" in data
        and data["status"] in (
            "pending",
            "in_progress",
            "completed",
        )
    ):
        task.status = data[
            "status"
        ]

    task.updated_at = (
        datetime.utcnow()
    )

    db.session.commit()

    analytics = (
        compute_analytics(
            current_user.id
        )
    )

    socketio.emit(
        "task_updated",
        {
            "task": task.to_dict(),
            "analytics": analytics,
        },
        room=f"user_{current_user.id}",
    )

    return jsonify({
        "message": "Task updated successfully",
        "task": task.to_dict(),
    })


@app.route(
    "/api/tasks/<int:task_id>",
    methods=["DELETE"],
)
@api_login_required
def delete_task(
    task_id,
):
    task = Task.query.filter_by(
        id=task_id,
        user_id=current_user.id,
    ).first()

    if not task:
        return jsonify({
            "error": "Task not found"
        }), 404

    db.session.delete(task)

    db.session.commit()

    analytics = (
        compute_analytics(
            current_user.id
        )
    )

    socketio.emit(
        "task_deleted",
        {
            "task_id": task_id,
            "analytics": analytics,
        },
        room=f"user_{current_user.id}",
    )

    return jsonify({
        "message": "Task deleted successfully"
    })


@app.route(
    "/api/analytics",
    methods=["GET"],
)
@api_login_required
def get_analytics():
    analytics = (
        compute_analytics(
            current_user.id
        )
    )

    return jsonify(
        analytics
    )


@socketio.on("connect")
def handle_connect():
    if current_user.is_authenticated:
        join_room(
            f"user_{current_user.id}"
        )

        emit(
            "connected",
            {
                "message": (
                    f"Welcome "
                    f"{current_user.username}"
                )
            },
        )


@socketio.on("disconnect")
def handle_disconnect():
    if current_user.is_authenticated:
        leave_room(
            f"user_{current_user.id}"
        )


@socketio.on("join")
def handle_join(data):
    if current_user.is_authenticated:
        join_room(
            f"user_{current_user.id}"
        )

        emit(
            "joined",
            {
                "room": (
                    f"user_"
                    f"{current_user.id}"
                )
            },
        )


if __name__ == "__main__":
    with app.app_context():
        db.create_all()

        print(
            "Database tables created successfully"
        )

    socketio.run(
        app,
        debug=os.getenv(
            "FLASK_ENV"
        ) == "development",
        host="0.0.0.0",
        port=5000,
    )