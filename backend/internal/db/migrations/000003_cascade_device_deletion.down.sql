ALTER TABLE deployment_devices DROP CONSTRAINT IF EXISTS deployment_devices_device_id_fkey;
ALTER TABLE deployment_devices ADD CONSTRAINT deployment_devices_device_id_fkey 
    FOREIGN KEY (device_id) REFERENCES devices(id);
