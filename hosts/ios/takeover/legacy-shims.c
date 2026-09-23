// System functions the engine needs that older iOS releases do not have, for ios-native tiers
// below iOS 10 (tools/ios-native.ts links this only there).
//
// Rust's std (std::time, HashMap seeds) and QuickJS call clock_gettime (iOS 10+) and
// CCRandomGenerateBytes (iOS 8+). The link SDK lists the current OS's exports, so without these
// the app links fine and then dies at launch on iOS 6-9 ("dyld: Symbol not found"). Definitions
// in the executable take precedence over the system libraries at link time; on newer iOS they
// simply shadow the system versions.
#include <stdint.h>
#include <stdlib.h>
#include <time.h>
#include <sys/time.h>
#include <mach/mach.h>
#include <mach/mach_time.h>
#include <mach/thread_act.h>

static void pocket_from_ns(uint64_t ns, struct timespec *tp) {
  tp->tv_sec = (time_t)(ns / 1000000000ull);
  tp->tv_nsec = (long)(ns % 1000000000ull);
}

static uint64_t pocket_mach_ns(void) {
  static mach_timebase_info_data_t timebase;
  if (timebase.denom == 0) mach_timebase_info(&timebase);
  return mach_absolute_time() * timebase.numer / timebase.denom;
}

int clock_gettime(clockid_t clock, struct timespec *tp) {
  if (tp == NULL) return -1;
  switch (clock) {
    case CLOCK_REALTIME: {
      struct timeval tv;
      if (gettimeofday(&tv, NULL) != 0) return -1;
      tp->tv_sec = tv.tv_sec;
      tp->tv_nsec = tv.tv_usec * 1000;
      return 0;
    }
    case CLOCK_MONOTONIC:
    case CLOCK_MONOTONIC_RAW:
    case CLOCK_MONOTONIC_RAW_APPROX:
    case CLOCK_UPTIME_RAW:
    case CLOCK_UPTIME_RAW_APPROX:
      // mach_absolute_time pauses while asleep (UPTIME semantics); close enough for the
      // monotonic clocks, which only have to be monotonic here.
      pocket_from_ns(pocket_mach_ns(), tp);
      return 0;
    case CLOCK_THREAD_CPUTIME_ID: {
      thread_basic_info_data_t info;
      mach_msg_type_number_t count = THREAD_BASIC_INFO_COUNT;
      mach_port_t thread = mach_thread_self();
      kern_return_t kr = thread_info(thread, THREAD_BASIC_INFO, (thread_info_t)&info, &count);
      mach_port_deallocate(mach_task_self(), thread);
      if (kr != KERN_SUCCESS) return -1;
      uint64_t us = (uint64_t)(info.user_time.seconds + info.system_time.seconds) * 1000000ull +
                    (uint64_t)(info.user_time.microseconds + info.system_time.microseconds);
      pocket_from_ns(us * 1000ull, tp);
      return 0;
    }
    case CLOCK_PROCESS_CPUTIME_ID: {
      struct task_thread_times_info info;
      mach_msg_type_number_t count = TASK_THREAD_TIMES_INFO_COUNT;
      if (task_info(mach_task_self(), TASK_THREAD_TIMES_INFO, (task_info_t)&info, &count) !=
          KERN_SUCCESS) {
        return -1;
      }
      uint64_t us = (uint64_t)(info.user_time.seconds + info.system_time.seconds) * 1000000ull +
                    (uint64_t)(info.user_time.microseconds + info.system_time.microseconds);
      pocket_from_ns(us * 1000ull, tp);
      return 0;
    }
    default:
      return -1;
  }
}

// <CommonCrypto/CommonRandom.h>: CCRNGStatus CCRandomGenerateBytes(const void *, size_t).
int32_t CCRandomGenerateBytes(void *bytes, size_t count) {
  arc4random_buf(bytes, count); // iOS 4.3+
  return 0;                     // kCCSuccess
}
