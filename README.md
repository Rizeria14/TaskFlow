# TaskFlow — Smart Task Management System

A Flask-based task management web application with PostgreSQL, REST APIs, WebSockets, and Pandas/NumPy analytics.

## Tech Stack

- Python
- Flask
- PostgreSQL
- Flask-SocketIO
- Pandas
- NumPy
- HTML/CSS/JavaScript

## Setup

### 1. Clone Repository

bash

git clone https://github.com/Rizeria14/TaskFlow.git

cd TaskFlow


### 2. Create Virtual Environment

#### Windows

bash

python -m venv venv

venv\Scripts\activate


#### Linux / macOS

bash

python3 -m venv venv

source venv/bin/activate


### 3. Install Dependencies

bash

pip install -r requirements.txt


### 4. Create PostgreSQL Database

sql
CREATE DATABASE taskmanager;


### 5. Configure `.env`


SECRET_KEY=your_secret_key
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/taskmanager


### 6. Run Application

bash

python app.py


Open:


http://127.0.0.1:5000
