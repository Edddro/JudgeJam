@echo off
echo Starting JudgeJam...

REM Start MongoDB (if not running)
echo Starting MongoDB...
net start MongoDB

REM Start backend
echo Starting backend...
start cmd /k "cd backend && node repo.js"

REM Start Python server
echo Starting Python server...
start cmd /k "cd frontend && python server.py"

REM Start frontend
echo Starting frontend...
start cmd /k "cd frontend && npm run dev"

echo All components started!
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8124
pause 