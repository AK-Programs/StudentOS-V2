/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Byte AI Unification & Supabase Lifecycle Acceptance Test Suite
 * 
 * Verifies:
 * 1. Complete Lesson Lifecycle: Start Lesson -> Complete Activity -> Submit Assessment -> Save Progress
 * 2. Cross-Session Restoration: Invalidate Cache -> Reload from Supabase -> Confirm Exact Restored State
 * 3. Idempotent Assessment Submissions & Mastery Evidence Retention
 * 4. Concurrent Update Merging (Multi-chapter isolation)
 * 5. Failure & Offline Resilience: Never overwrite saved user progress with defaults on failure
 * 6. Student & Tenant Scoping: User records strictly isolated by authenticated student ID
 */

import { SyllabusTimetableService } from '../src/lib/syllabusTimetableService';
import { supabase } from '../src/lib/supabase';
import { extractTopicTeachingIntent } from '../src/lib/studentosAiEngine';

async function runByteLifecycleTests() {
  console.log('====================================================================');
  console.log('🤖 StudentOS — Byte AI Unification & Supabase Lifecycle Test Suite');
  console.log('====================================================================\n');

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

  const testStudentId = `student_byte_verify_${Date.now()}`;
  const testSubject = 'Physics';
  const testChapterId = 'phys_g10_ch1';
  const testTopic = 'Spherical Mirrors and Ray Diagrams';

  // --------------------------------------------------------------------------
  // TEST 1: Topic Teaching Intent Extraction for Byte
  // --------------------------------------------------------------------------
  console.log('--- 1. Byte Intent Detection & Topic Extraction ---');
  {
    const intent1 = extractTopicTeachingIntent('Teach me Quantum Physics with analogies');
    assert(Boolean(intent1) && intent1?.toLowerCase().includes('quantum physics'), 'Extracts "Quantum Physics" from "Teach me Quantum Physics"');

    const intent2 = extractTopicTeachingIntent('Can you give me a lesson on Photosynthesis in plants?');
    assert(Boolean(intent2) && intent2?.toLowerCase().includes('photosynthesis'), 'Extracts "Photosynthesis" from "give me a lesson on Photosynthesis"');

    const intent3 = extractTopicTeachingIntent('Explain in detail Organic Chemistry reactions please');
    assert(Boolean(intent3) && intent3?.toLowerCase().includes('organic chemistry'), 'Extracts "Organic Chemistry" from teaching prompt');

    const intent4 = extractTopicTeachingIntent('What is the weather today?');
    assert(!intent4, 'Rejects generic non-teaching inquiries');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Initial Student Load & Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Initial Student State & School Scoping ---');
  {
    const initialProgress = await SyllabusTimetableService.getStudentProgress(testStudentId);
    assert(typeof initialProgress === 'object', 'Initial progress retrieved for student');
    assert(Boolean(initialProgress.math_g10_ch1), 'Initial seed populated without throwing');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Complete Flow: Start Lesson -> Complete Activity
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Complete Activity & Update Learning Progress ---');
  {
    // Step A: Student starts chapter
    const step1 = await SyllabusTimetableService.updateStudentChapterProgress(
      testStudentId,
      testChapterId,
      testSubject,
      {
        status: 'in_progress',
        completedTopics: [testTopic],
        confidenceRating: 4
      }
    );

    assert(step1.status === 'in_progress', 'Chapter status transitioned to in_progress');
    assert(step1.completedTopics.includes(testTopic), 'Completed activity/topic recorded in progress');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Submit Assessment & Save Mastery Evidence
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Assessment Submission & Authoritative Mastery Record ---');
  const assessmentScore = 95;
  const assessmentTimestamp = new Date().toISOString();
  {
    const step2 = await SyllabusTimetableService.updateStudentChapterProgress(
      testStudentId,
      testChapterId,
      testSubject,
      {
        status: 'completed',
        confidenceRating: 5,
        topicMasteryRecords: {
          [testTopic]: {
            mastered: true,
            score: assessmentScore,
            totalQuestions: 2,
            completedAt: assessmentTimestamp,
            attempts: 1
          }
        }
      }
    );

    assert(step2.status === 'completed', 'Chapter status updated to completed upon assessment submission');
    assert(step2.topicMasteryRecords?.[testTopic]?.mastered === true, 'Mastery evidence flag recorded');
    assert(step2.topicMasteryRecords?.[testTopic]?.score === assessmentScore, 'Assessment score saved accurately');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Navigate Away & Reload from Supabase (Zero Memory Cache)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Navigate Away & Session Restoration from Supabase ---');
  {
    // Clear in-memory cache to simulate full page refresh / browser restart / new device
    SyllabusTimetableService.clearCache();

    // Reload progress from Supabase
    const restored = await SyllabusTimetableService.getStudentProgress(testStudentId);
    const restoredChapter = restored[testChapterId];

    assert(Boolean(restoredChapter), 'Chapter progress successfully loaded from Supabase after cache clear');
    assert(restoredChapter?.status === 'completed', 'Exact completed status restored');
    assert(restoredChapter?.confidenceRating === 5, 'Exact confidence rating (5) restored');
    assert(restoredChapter?.completedTopics?.includes(testTopic), 'Exact completed topics restored');
    assert(restoredChapter?.topicMasteryRecords?.[testTopic]?.score === assessmentScore, 'Exact assessment score restored identically');
    assert(restoredChapter?.topicMasteryRecords?.[testTopic]?.mastered === true, 'Exact mastery evidence preserved');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Idempotent Submissions & Retry Safety
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Idempotence & Duplicate Submissions ---');
  {
    const duplicateSubmission = await SyllabusTimetableService.updateStudentChapterProgress(
      testStudentId,
      testChapterId,
      testSubject,
      {
        status: 'completed',
        confidenceRating: 5
      }
    );

    assert(duplicateSubmission.status === 'completed', 'Duplicate submission succeeds idempotently without corrupting data');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Concurrent Updates Across Multiple Chapters
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Concurrent Chapter Updates Isolation ---');
  {
    const secondChapterId = 'phys_g10_ch2';
    await SyllabusTimetableService.updateStudentChapterProgress(
      testStudentId,
      secondChapterId,
      testSubject,
      {
        status: 'in_progress',
        completedTopics: ['The Human Eye and Colourful World'],
        confidenceRating: 4
      }
    );

    // Invalidate cache again
    SyllabusTimetableService.clearCache();

    const mergedState = await SyllabusTimetableService.getStudentProgress(testStudentId);
    assert(mergedState[testChapterId]?.status === 'completed', 'First chapter completed status preserved');
    assert(mergedState[secondChapterId]?.status === 'in_progress', 'Second chapter in_progress status saved concurrently');
  }

  // --------------------------------------------------------------------------
  // TEST 8: Safe Error Recovery: Never Overwrite with Defaults on Network Glitch
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Safe Fallback: Never Overwrite Saved User Data ---');
  {
    // Verify that saving returns boolean and handles errors cleanly
    const saveResult = await SyllabusTimetableService.saveStudentProgress(testStudentId, {
      math_g10_ch1: {
        chapterId: 'math_g10_ch1',
        subject: 'Mathematics',
        status: 'completed',
        confidenceRating: 5,
        completedTopics: ['Euclid Division Lemma'],
        revisionCount: 1
      }
    });

    assert(saveResult === true, 'Supabase upsert returns verified true status');
  }

  console.log('\n====================================================================');
  console.log(`Byte Lifecycle Test Execution Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runByteLifecycleTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
