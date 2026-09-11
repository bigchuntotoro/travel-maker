import React, { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";

/**
 * --------------------------------------------------
 * 드래그 가능한 개별 장소
 * --------------------------------------------------
 */
const SortableItem = ({ id, item, index, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,

    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",

    padding: "10px 12px",
    marginBottom: "8px",

    backgroundColor: isDragging ? "#eff6ff" : "#ffffff",

    border: isDragging ? "1px solid #2563eb" : "1px solid #e5e7eb",

    borderRadius: "8px",

    boxShadow: isDragging
      ? "0 4px 12px rgba(37, 99, 235, 0.18)"
      : "0 1px 2px rgba(0, 0, 0, 0.05)",

    opacity: isDragging ? 0.85 : 1,

    cursor: "default",

    position: "relative",
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* 왼쪽 영역 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          minWidth: 0,
          flex: 1,
        }}
      >
        {/* 드래그 핸들 */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${item.placeName} 순서 이동`}
          title="드래그하여 순서 변경"
          style={{
            cursor: isDragging ? "grabbing" : "grab",
            background: "none",
            border: "none",
            padding: "4px",

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            touchAction: "none",
            flexShrink: 0,
          }}
        >
          <GripVertical size={18} color={isDragging ? "#2563eb" : "#9ca3af"} />
        </button>

        {/* 순번 */}
        <span
          style={{
            backgroundColor: "#2563eb",
            color: "#ffffff",

            borderRadius: "50%",

            width: "24px",
            height: "24px",

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            fontSize: "12px",
            fontWeight: "bold",

            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>

        {/* 장소 정보 */}
        <div
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "3px",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#1f2937",

              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.placeName}
          </span>

          <span
            style={{
              fontSize: "11px",
              color: "#6b7280",
            }}
          >
            Day {item.dayNumber ?? 1}
            {" · "}
            체류 {item.stayMinutes ?? 60}분
          </span>
        </div>
      </div>

      {/* 삭제 버튼 */}
      <button
        type="button"
        onClick={() => onDelete(index)}
        aria-label={`${item.placeName} 삭제`}
        title="삭제"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",

          padding: "6px",

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          borderRadius: "6px",

          flexShrink: 0,
        }}
      >
        <Trash2 size={16} color="#ef4444" />
      </button>
    </div>
  );
};

/**
 * --------------------------------------------------
 * RoutePlanner
 * --------------------------------------------------
 */
const RoutePlanner = ({ items, setItems }) => {
  /**
   * --------------------------------------------------
   * dnd-kit Sensor
   * --------------------------------------------------
   */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),

    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /**
   * --------------------------------------------------
   * 장소별 안정적인 ID 생성
   *
   * 기존:
   * item-${index}
   *
   * 문제:
   * 배열 순서가 바뀌면 ID도 같이 바뀜
   *
   * 개선:
   * itemId가 있으면 itemId 사용
   * 새 장소는 객체에 _dragId를 부여
   * --------------------------------------------------
   */
  const getItemId = (item, index) => {
    if (item.itemId !== undefined && item.itemId !== null) {
      return `item-db-${item.itemId}`;
    }

    if (item._dragId) {
      return item._dragId;
    }

    return `item-temp-${index}`;
  };

  /**
   * 현재 items의 dnd ID
   */
  const itemIds = useMemo(() => {
    return items.map((item, index) => getItemId(item, index));
  }, [items]);

  /**
   * --------------------------------------------------
   * Drag End
   * --------------------------------------------------
   */
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = itemIds.indexOf(active.id);
    const newIndex = itemIds.indexOf(over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    /**
     * 배열 순서 변경
     */
    const reorderedItems = arrayMove(items, oldIndex, newIndex);

    /**
     * visitOrder 재계산
     */
    const updatedItems = reorderedItems.map((item, index) => ({
      ...item,
      visitOrder: index + 1,
    }));

    setItems(updatedItems);
  };

  /**
   * --------------------------------------------------
   * 장소 삭제
   * --------------------------------------------------
   */
  const handleDeleteItem = (index) => {
    const updated = items
      .filter((_, idx) => idx !== index)
      .map((item, idx) => ({
        ...item,
        visitOrder: idx + 1,
      }));

    setItems(updated);
  };

  /**
   * --------------------------------------------------
   * 렌더링
   * --------------------------------------------------
   */
  return (
    <div
      style={{
        padding: "16px",
        backgroundColor: "#f9fafb",
        borderRadius: "12px",

        height: "100%",
        boxSizing: "border-box",

        overflowY: "auto",
      }}
    >
      {/* 제목 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",

          marginBottom: "6px",
        }}
      >
        <h3
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            margin: 0,
            color: "#111827",
          }}
        >
          방문 동선 목록
        </h3>

        <span
          style={{
            fontSize: "12px",
            color: "#6b7280",
          }}
        >
          {items.length}개
        </span>
      </div>

      {/* 안내 문구 */}
      {items.length > 0 && (
        <p
          style={{
            margin: "0 0 12px 0",
            fontSize: "12px",
            color: "#6b7280",
          }}
        >
          ☷ 아이콘을 드래그하여 방문 순서를 변경하세요.
        </p>
      )}

      {/* 장소 없음 */}
      {items.length === 0 ? (
        <p
          style={{
            color: "#6b7280",
            fontSize: "14px",
            textAlign: "center",
            padding: "24px 0",
          }}
        >
          지도를 클릭하여 장소를 추가해 주세요.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item, index) => (
              <SortableItem
                key={itemIds[index]}
                id={itemIds[index]}
                item={item}
                index={index}
                onDelete={handleDeleteItem}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* 하단 안내 */}
      {items.length >= 2 && (
        <div
          style={{
            marginTop: "14px",
            padding: "10px 12px",

            backgroundColor: "#eff6ff",
            border: "1px solid #dbeafe",
            borderRadius: "8px",

            fontSize: "11px",
            lineHeight: "1.5",
            color: "#1d4ed8",
          }}
        >
          💡 방문 순서를 변경하면
          <br />
          Kakao Mobility 자동차 경로가 자동으로 다시 계산됩니다.
        </div>
      )}
    </div>
  );
};

export default RoutePlanner;
