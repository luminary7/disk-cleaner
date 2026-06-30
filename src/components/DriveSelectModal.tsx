import { useState, useEffect, useCallback } from 'react';
import { Modal, Checkbox, Typography, Space, Spin, Empty } from 'antd';
import driveImg from '../assets/ui-kit/disk-drive.png';

const { Text } = Typography;

interface DriveSelectModalProps {
  open: boolean;
  onConfirm: (drives: string[]) => void;
  onCancel: () => void;
}

export default function DriveSelectModal({ open, onConfirm, onCancel }: DriveSelectModalProps) {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [selected, setSelected] = useState<string[]>(['C:']);
  const [loading, setLoading] = useState(false);

  // 打开弹窗时检测盘符
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(['C:']);
    (window.electronAPI?.detectDrives() ?? Promise.resolve([]))
      .then((list) => {
        setDrives(list);
        // 如果 C: 不可用，清空默认选中
        if (!list.some((d) => d.letter === 'C')) {
          setSelected([]);
        }
      })
      .catch(() => setDrives([]))
      .finally(() => setLoading(false));
  }, [open]);

  const handleConfirm = useCallback(() => {
    if (selected.length === 0) return;
    onConfirm(selected.map((letter) => `${letter}:\\`));
  }, [selected, onConfirm]);

  const options = drives.map((d) => ({
    label: (
      <Space>
        <img src={driveImg} alt="磁盘" style={{ width: 24, height: 24 }} />
        <Text strong>{d.letter}:</Text>
        <Text type="secondary">{d.label || `${d.letter}盘`}</Text>
      </Space>
    ),
    value: d.letter,
  }));

  return (
    <Modal
      title="选择扫描盘符"
      open={open}
      onOk={handleConfirm}
      onCancel={onCancel}
      okText="开始扫描"
      cancelText="取消"
      okButtonProps={{ disabled: selected.length === 0 }}
      width={420}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spin />
        </div>
      ) : drives.length === 0 ? (
        <Empty description="未检测到可用盘符" />
      ) : (
        <>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
            请选择要扫描的磁盘（至少选择一个）
          </Text>
          <Checkbox.Group
            options={options}
            value={selected}
            onChange={(values) => setSelected(values as string[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          />
          {selected.length === 0 && (
            <Text type="danger" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
              请至少选择一个盘符
            </Text>
          )}
        </>
      )}
    </Modal>
  );
}
