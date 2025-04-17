use tauri::{Manager, Window, PhysicalPosition, PhysicalSize, State}; // Added State
use tauri::Emitter; // Import the Emitter trait
use std::{thread, sync::{Arc, atomic::{AtomicBool, Ordering}}}; // Added Arc, AtomicBool, Ordering
use std::time::Duration;
use serde::Serialize; // Import Serialize

// --- Payload for direction change event ---
#[derive(Clone, Serialize)]
struct DirectionPayload {
    direction: String,
}
// --- End Payload ---

// --- State to manage movement ---
struct MovementState {
  // Use Arc<AtomicBool> for simplicity here
  is_moving: Arc<AtomicBool>,
}

impl Default for MovementState {
    fn default() -> Self {
        Self {
            is_moving: Arc::new(AtomicBool::new(false)), // Start not moving
        }
    }
}
// --- End State ---


// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// --- Command to START Movement ---
#[tauri::command]
fn start_window_movement(window: Window, state: State<'_, MovementState>, direction_arg: i32) {
    // Try to set the state to true. If it was already true, compare_exchange returns Err.
    if state.is_moving.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_ok() {
        // State was successfully changed from false to true, so we start the thread.
        println!("Starting movement."); // For debugging

        // Clone the Arc<AtomicBool> and Window to move into the thread
        let window_clone = window.clone();
        let is_moving_clone = state.is_moving.clone();

        // Spawn the movement thread
        thread::spawn(move || {
            let mut direction: i32 = direction_arg; // Use the argument

            // Loop continues as long as is_moving is true
            while is_moving_clone.load(Ordering::SeqCst) {
                // Get current monitor dimensions to stay within bounds
                if let Ok(Some(monitor)) = window_clone.current_monitor() {
                    let monitor_size = monitor.size();
                    let window_size = window_clone.outer_size().unwrap_or(PhysicalSize::new(200, 200));
                    let current_pos = window_clone.outer_position().unwrap_or(PhysicalPosition::new(0, 0));

                    let min_x = -72;
                    let max_x = monitor_size.width as i32 - window_size.width as i32 + 72;
                    let next_x = current_pos.x + direction;

                    // Reverse direction if hitting screen edges (with 72px margin)
                    if next_x < min_x || next_x > max_x {
                        direction *= -1;
                        // Emit event immediately when direction changes
                        let new_direction_str = if direction > 0 { "right" } else { "left" };
                        window_clone.emit("direction-changed", DirectionPayload { direction: new_direction_str.to_string() })
                            .expect("Failed to emit direction change event");
                    }

                    // Clamp new_x within bounds
                    let new_x = (current_pos.x + direction).clamp(min_x, max_x);
                    let _ = window_clone.set_position(PhysicalPosition::new(new_x, current_pos.y));
                } else {
                    // Fallback if monitor info fails
                    let current_pos = window_clone.outer_position().unwrap_or(PhysicalPosition::new(0,0));
                    let _ = window_clone.set_position(PhysicalPosition::new(current_pos.x + direction, current_pos.y));
                     if current_pos.x > 1000 || current_pos.x < 0 { // Basic boundary guess - also emit event here if direction changes
                         direction *= -1;
                         // Emit event immediately when direction changes
                         let new_direction_str = if direction > 0 { "right" } else { "left" };
                         window_clone.emit("direction-changed", DirectionPayload { direction: new_direction_str.to_string() })
                            .expect("Failed to emit direction change event");
                     }
                    println!("Could not get monitor info during movement.");
                }
                thread::sleep(Duration::from_millis(50)); // Adjust speed
            }
            println!("Movement thread stopped."); // For debugging
        });
    } else {
        // If compare_exchange failed, it means is_moving was already true.
        println!("Movement already active."); // For debugging
    }
}
// --- End START Command ---

// --- Command to STOP Movement ---
#[tauri::command]
fn stop_window_movement(state: State<'_, MovementState>) {
    // Simply set the atomic boolean to false.
    // The movement thread's loop condition will detect this and exit.
    state.is_moving.store(false, Ordering::SeqCst);
    println!("Requested movement stop."); // For debugging
}
// --- End STOP Command ---

#[tauri::command]
fn get_window_info(window: Window) -> Result<(i32, i32, u32, u32, u32, u32), String> {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let monitor_size = monitor.size();
        let window_pos = window.outer_position().unwrap_or(PhysicalPosition::new(0, 0));
        let window_size = window.outer_size().unwrap_or(PhysicalSize::new(192, 192));
        
        Ok((
            window_pos.x,
            window_pos.y,
            monitor_size.width,
            monitor_size.height,
            window_size.width,
            window_size.height
        ))
    } else {
        Err("Could not get monitor info".to_string())
    }
}

#[tauri::command]
fn change_window_size(window: Window, width: u32, height: u32) -> Result<(), String> {
    window.set_size(PhysicalSize::new(width*2, height*2))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn change_window_pos(window: Window, x: i32, y: i32) -> Result<(), String> {
    window.set_position(PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MovementState::default()) // Add the state management
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            start_window_movement, // Register the start command
            stop_window_movement, // Register the stop command
            get_window_info,
            change_window_size,
            change_window_pos
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
