import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * `GET /api/browse-directory`: Opens a native folder picker dialog and
 * returns the selected directory path.
 *
 * @remarks
 * Uses AppleScript's `choose folder` dialog (macOS only). Responds 200
 * with the selected path on success, or 400 when no folder was selected.
 *
 * @returns A JSON response with `{ path }` on selection, or an error.
 */
export async function GET() {
  try {
    const { stdout } = await execAsync(
      `osascript -e 'POSIX path of (choose folder with prompt "Select Repository")'`
    );
    const selectedPath = stdout.trim();
    if (!selectedPath) {
      return NextResponse.json({ success: false, error: 'No folder selected' }, { status: 400 });
    }
    return NextResponse.json({ success: true, path: selectedPath });
  } catch {
    // User cancelled the dialog
    return NextResponse.json({ success: false, error: 'cancelled' }, { status: 400 });
  }
}
