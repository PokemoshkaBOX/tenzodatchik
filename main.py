import eel
import serial
import serial.tools.list_ports
import time
import threading
from datetime import datetime, timedelta
import pandas as pd

ser = None
reading_thread = None
reading_active = False
pin6_state = False
pin7_state = False

data_buffer = []
data_buffer1 = []
max_value = float('-inf')
min_value = float('inf')
start_time = datetime.now()
end_time = None

eel.init('web')

@eel.expose
def get_com_ports():
    ports = serial.tools.list_ports.comports()
    return [port.device for port in ports]

@eel.expose
def start_reading(selected_port, duration):
    global ser, reading_active, start_time, end_time
    ser = serial.Serial(selected_port, 115200, timeout=1)
    reading_active = True
    start_time = datetime.now()
    end_time = start_time + timedelta(minutes=duration)
    start_reading_thread()

@eel.expose
def stop_reading():
    global reading_active
    reading_active = False
    if ser and ser.is_open:
        ser.close()

def read_three_bytes():
    data = ser.read(3)
    if len(data) == 3:
        byte1, byte2, byte3 = data
        combined = (byte1 << 8) | byte2
        return combined, byte3
    return None, None

def start_reading_thread():
    global reading_thread
    reading_thread = threading.Thread(target=update_chart)
    reading_thread.start()

def update_chart():
    global max_value, min_value, reading_active, end_time
    base_value = 65535
    while reading_active:
        if datetime.now() > end_time - timedelta(milliseconds=50):
            deactivate_actuator()
            eel.updatePlateStatus("Состояние плиты: неизвестно")
            stop_reading()
            time.sleep(400)
            eel.updatePlateStatus("Испытание завершено")
            break

        if ser.in_waiting > 0:
            combined, byte3 = read_three_bytes()
            if combined is not None:
                data_buffer1.append(combined)
                data_buffer.append(combined)
                if len(data_buffer) >= 3:
                    avg_value = sum(data_buffer[-3:]) / 3
                    avg_value = round(avg_value, ndigits=1)
                    deviation_percent = round(((avg_value - base_value) / base_value) * 100, ndigits=1)
                    all_millisec = int((datetime.now() - start_time).total_seconds() * 1000)
                    eel.updateChart(deviation_percent, all_millisec / 1000)
                    data_buffer.clear()
                    if avg_value > max_value:
                        max_value = avg_value
                    if avg_value < min_value:
                        min_value = avg_value
                    if len(data_buffer1) >= 100:
                        raznica = round((max_value - min_value) * 0.6, ndigits=1)
                        eel.updateMaxMinChart(all_millisec / 1000, raznica, max_value, min_value)
                        max_value = float('-inf')
                        min_value = float('inf')
                        data_buffer1.clear()
                    plate_status = "Плита поднята" if byte3 == 1 else "Плита опущена"
                    eel.updatePlateStatus(plate_status)

def raise_plate():
    ser.write(bytearray([101, 2, 0]))
    time.sleep(0.1)
    ser.write(bytearray([101, 4, 0]))
    time.sleep(0.1)

def deactivate_actuator():
    ser.write(bytearray([101, 1, 0]))
    time.sleep(0.1)
    ser.write(bytearray([101, 3, 0]))
    time.sleep(0.1)

@eel.expose
def toggle_pin(pin):
    global pin6_state, pin7_state
    if pin == 6:
        pin6_state = not pin6_state
        ser.write(bytearray([101, 2 if pin6_state else 1, 0]))
    elif pin == 7:
        pin7_state = not pin7_state
        ser.write(bytearray([101, 4 if pin7_state else 3, 0]))
    return {'pin': pin, 'state': 'HIGH' if (pin6_state if pin == 6 else pin7_state) else 'LOW'}

@eel.expose
def save_to_excel():
    # Get data from the min/max table
    table_data = []
    table = document.getElementById('dataTable2')
    rows = table.getElementsByTagName('tr')
    for row in rows:
        cells = row.getElementsByTagName('td')
        row_data = [cell.innerText for cell in cells]
        table_data.append(row_data)

    # Create a DataFrame
    df = pd.DataFrame(table_data, columns=['Time', 'Raznica', 'Max', 'Min'])

    # Save DataFrame to Excel
    df.to_excel('min_max_data.xlsx', index=False)

@eel.expose
def close_application():
    stop_reading()

if __name__ == '__main__':
    eel.start('index.html', port=8000)