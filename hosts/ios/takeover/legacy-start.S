// Program entry for tiers below iOS 6 (tools/ios-native.ts links this, with -nostartfiles, only
// there).
//
// iOS 6 added LC_MAIN: dyld calls main() itself. Older releases start the executable at the
// LC_UNIXTHREAD entry point, `start`, which the linker took from crt1.3.1.o — no longer shipped
// by Xcode ("library 'crt1.3.1.o' not found"). This is that routine for ARM (Apple Csu start.s,
// iOS 3.1+ flavour: dyld has already run every initializer): the kernel leaves argc, argv[],
// NULL, envp[], NULL, apple[] on the stack; call main(argc, argv, envp, apple), then exit().
// ARM, not Thumb: see NO_THUMB in tools/ios-native.ts.
#if defined(__arm__)
	.text
	.arm
	.align	2
	.globl	start
start:
	ldr	r0, [sp]		// argc
	add	r1, sp, #4		// argv
	add	r4, r0, #1		// argc + 1 (argv's NULL)
	add	r2, r1, r4, lsl #2	// envp
	bic	sp, sp, #7		// 8-byte stack alignment (AAPCS)
	mov	r3, r2
1:
	ldr	r4, [r3], #4		// skip envp[] to its NULL: apple[] follows
	cmp	r4, #0
	bne	1b
	bl	_main
	b	_exit
#endif
