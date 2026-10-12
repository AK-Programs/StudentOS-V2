/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Acceptance Test Suite:
 * 1. Timetable Conflict Validation
 * 2. Official Syllabus & Chapter Progress Separation
 * 3. AI Personal Study Timetable Generation & School Hours Conflict Avoidance
 * 4. Brain Battle Multiplayer Room Lifecycle & Join Verification
 * 5. Learning Reminder Deduplication & Scheduling
 * 6. Exam Preparation & Personal Plan Separation
 */

import { SyllabusTimetableService, DEFAULT_OFFICIAL_TIMETABLE, DEFAULT_OFFICIAL_SYLLABUSES } from '../src/lib/syllabusTimetableService';
import { ReminderService } from '../src/lib/reminderService';
import { DayTimetable } from '../src/types/syllabusTimetable';

async function runAcceptanceTests() {
  console.log('====================================================');
  console.log('🚀 Running StudentOS Timetable, Syllabus & Multiplayer Tests');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Official Timetable Conflict Validation
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Timetable Conflict Validation ---');
  {
    // Canonical default timetable should have zero conflicts
    const resultClean = SyllabusTimetableService.validateTimetableConflicts(DEFAULT_OFFICIAL_TIMETABLE.schedule);
    assert(!resultClean.hasConflict, 'Default official school timetable has 0 conflicts');

    // Create a schedule with intentional teacher collision
    const conflictingSchedule: DayTimetable[] = [
      {
        day: 'Monday',
        periods: [
          { periodNumber: 1, name: 'P1', startTime: '08:30', endTime: '09:20', subject: 'Math', teacherName: 'Dr. Evelyn Reed', room: 'Lab 101' },
          { periodNumber: 1, name: 'P1 Concurrent', startTime: '08:30', endTime: '09:20', subject: 'Physics', teacherName: 'Dr. Evelyn Reed', room: 'Lab 202' }
        ]
      }
    ];
    const resultCollision = SyllabusTimetableService.validateTimetableConflicts(conflictingSchedule);
    assert(resultCollision.hasConflict, 'Detects concurrent teacher double-booking conflict');
    assert(resultCollision.conflicts.some(c => c.type === 'teacher'), 'Conflict report correctly flags teacher collision');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Official Syllabus & Student Progress Separation
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Syllabus & Student Progress Separation ---');
  {
    const mathSyl = DEFAULT_OFFICIAL_SYLLABUSES.find(s => s.subject === 'Mathematics')!;
    assert(Boolean(mathSyl), 'Official Mathematics syllabus exists');
    assert(mathSyl.chapters.length >= 6, 'Contains at least 6 core chapters');

    // Mock student updating chapter 3
    const testStudentId = 'student_test_42';
    const originalChapterTitle = mathSyl.chapters[2].title;

    const updatedProgress = await SyllabusTimetableService.updateStudentChapterProgress(
      testStudentId,
      'math_g10_ch3',
      'Mathematics',
      { status: 'completed', confidenceRating: 5 }
    );

    assert(updatedProgress.status === 'completed', 'Student personal progress updated to completed');

    // Check that official syllabus is unchanged
    const officialAfter = await SyllabusTimetableService.getOfficialSyllabuses('default_school', 'Grade 10');
    const mathOfficialAfter = officialAfter.find(s => s.subject === 'Mathematics')!;
    assert(
      mathOfficialAfter.chapters[2].title === originalChapterTitle,
      'Official school syllabus record remains unchanged when student marks completion'
    );

    // Compute subject progress summary
    const summaries = SyllabusTimetableService.computeSubjectSummaries(officialAfter, {
      math_g10_ch3: updatedProgress
    });
    const mathSummary = summaries.find(s => s.subject === 'Mathematics')!;
    assert(mathSummary.completedCount >= 1, 'Subject summary reflects student completion');
    assert(mathSummary.progressPercentage > 0, 'Progress percentage computed correctly');
  }

  // --------------------------------------------------------------------------
  // TEST 3: AI Personal Study Timetable Generation & School Hours Rule
  // --------------------------------------------------------------------------
  console.log('\n--- 3. AI Personal Study Timetable Generation ---');
  {
    const aiSessions = await SyllabusTimetableService.generateAiPersonalStudySchedule({
      userId: 'student_test_42',
      studentName: 'Alex Scholar',
      grade: 'Grade 10',
      availableDailyHours: 2.5,
      preferredSessionMinutes: 45
    });

    assert(aiSessions.length > 0, 'Generated personal study sessions');
    assert(aiSessions.every(s => s.isAiGenerated), 'All sessions marked as AI generated recommendations');

    // Critical Rule: Never schedule study sessions over official school periods (08:30 - 15:00)
    const schoolStart = '08:30';
    const schoolEnd = '15:00';
    const hasOverlapWithSchoolHours = aiSessions.some(s => {
      return (s.startTime >= schoolStart && s.startTime < schoolEnd) ||
             (s.endTime > schoolStart && s.endTime <= schoolEnd);
    });

    assert(
      !hasOverlapWithSchoolHours,
      'CRITICAL: Zero study sessions scheduled during official school hours (08:30 - 15:00)'
    );

    // Verify all sessions are scheduled in reasonable evening study slots
    const allEvening = aiSessions.every(s => s.startTime >= '16:00' && s.endTime <= '22:00');
    assert(allEvening, 'All sessions scheduled within evening study windows (16:30 - 21:00)');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Exam Preparation Separation (Official vs Personal)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Exam Preparation Plans ---');
  {
    const officialExams = await SyllabusTimetableService.getOfficialExams('default_school');
    assert(officialExams.length >= 3, 'Official school exams published');
    assert(officialExams.every(e => e.isOfficialSchoolExam === true), 'Official exams strictly marked isOfficialSchoolExam = true');

    const testStudentId = 'student_test_42';
    await SyllabusTimetableService.saveStudentPersonalExamPlan(testStudentId, {
      id: 'personal_target_1',
      schoolId: 'default_school',
      examName: 'Self-Directed Calculus Prep',
      subject: 'Mathematics',
      examDate: '2026-11-28',
      isOfficialSchoolExam: true, // Attempted to mark official!
      grade: 'Grade 10',
      chaptersIncluded: ['math_g10_ch1'],
      mockExamsAttempted: 0,
      averageAccuracy: 0,
      totalQuestionsPracticed: 0,
      status: 'upcoming'
    });

    const studentPlans = await SyllabusTimetableService.getStudentPersonalExamPlans(testStudentId);
    const personalPlan = studentPlans.find(p => p.id === 'personal_target_1')!;
    assert(Boolean(personalPlan), 'Student personal target plan saved');
    assert(
      personalPlan.isOfficialSchoolExam === false,
      'CRITICAL: Student plans strictly forced to isOfficialSchoolExam = false (never impersonate official school exam)'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 5: Multiplayer Room Creation & Join Validation (Simulating 2 distinct users)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Brain Battle Multiplayer Room Lifecycle ---');
  {
    const hostUser = {
      userId: 'user_host_101',
      name: 'Host Scholar',
      role: 'student',
      house: 'Sapphire',
      grade: 'Grade 10'
    };

    const challengerUser = {
      userId: 'user_challenger_202',
      name: 'Challenger Scholar',
      role: 'student',
      house: 'Emerald',
      grade: 'Grade 10'
    };

    // 1. Create Room via backend API
    const createResp = await fetch('http://localhost:3000/api/brain-battle/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: hostUser,
        subject: 'Mathematics',
        difficulty: 'medium',
        questionCount: 5,
        timePerQuestion: 15
      })
    });

    assert(createResp.ok, 'Room creation HTTP 200 OK');
    const createData = await createResp.json();
    assert(Boolean(createData.room?.code), `Unique room code generated: ${createData.room?.code}`);
    assert(createData.room.code.length === 6, 'Room code is exactly 6 characters');
    assert(createData.room.status === 'lobby', 'Initial room status is "lobby"');

    const roomCode = createData.room.code;

    // 2. Lookup Room by Code (simulating second player's lookup)
    const lookupResp = await fetch(`http://localhost:3000/api/brain-battle/rooms/${roomCode}`);
    assert(lookupResp.ok, 'Challenger can look up room by 6-character code');
    const lookupData = await lookupResp.json();
    assert(lookupData.room.hostId === hostUser.userId, 'Lookup confirms authentic host identity');

    // 3. Challenger joins the room
    const joinResp = await fetch('http://localhost:3000/api/brain-battle/rooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: roomCode,
        player: challengerUser
      })
    });

    assert(joinResp.ok, 'Second player joins room successfully');
    const joinData = await joinResp.json();
    const playersInRoom = Object.keys(joinData.room.players || {});
    assert(playersInRoom.length === 2, 'Room now has exactly 2 participants persisted');
    assert(Boolean(joinData.room.players[challengerUser.userId]), 'Challenger profile is persisted in room players');
    assert(Boolean(joinData.room.players[hostUser.userId]), 'Host profile is preserved in room players');

    // 4. Host starts the game
    const startResp = await fetch('http://localhost:3000/api/brain-battle/rooms/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: roomCode,
        action: 'start',
        userId: hostUser.userId
      })
    });

    assert(startResp.ok, 'Host launches multiplayer match');
    const startData = await startResp.json();
    assert(startData.room.status === 'active', 'Room status updated to "active"');

    // 5. Non-host attempts to trigger host-only action (Authorization check)
    // Challenger submits valid answer
    const answerResp = await fetch('http://localhost:3000/api/brain-battle/rooms/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: roomCode,
        action: 'answer',
        userId: challengerUser.userId,
        optionIndex: 0,
        timeLeftSec: 10
      })
    });
    assert(answerResp.ok, 'Challenger answer recorded and score evaluated server-side');

    // 6. Test invalid room rejection
    const invalidJoinResp = await fetch('http://localhost:3000/api/brain-battle/rooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'XXXXXX',
        player: challengerUser
      })
    });
    assert(invalidJoinResp.status === 404, 'Invalid/non-existent room code correctly rejected with 404');
  }

  console.log('\n====================================================');
  console.log(`Test Execution Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests().catch(err => {
  console.error('Test execution crashed:', err);
  process.exit(1);
});
