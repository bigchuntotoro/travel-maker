import React from "react";
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

// 드래그 가능한 리스트 아이템 컴포넌트
const SortableItem = ({ id, item, index, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    marginBottom: "8px",
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          {...attributes}
          {...listeners}
          style={{
            cursor: "grab",
            background: "none",
            border: "none",
            padding: "4px",
          }}
        >
          <GripVertical size={16} color="#9ca3af" />
        </button>
        <span
          style={{
            backgroundColor: "#2563eb",
            color: "#fff",
            borderRadius: "50%",
            width: "22px",
            height: "22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: "bold",
          }}
        >
          {index + 1}
        </span>
        <span style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937" }}>
          {item.placeName}
        </span>
      </div>
      <button
        onClick={() => onDelete(index)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px",
        }}
      >
        <Trash2 size={16} color="#ef4444" />
      </button>
    </div>
  );
};

const RoutePlanner = ({ items, setItems }) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = items.findIndex((_, idx) => `item-${idx}` === active.id);
      const newIndex = items.findIndex((_, idx) => `item-${idx}` === over.id);

      const reorderedItems = arrayMove(items, oldIndex, newIndex).map(
        (item, idx) => ({
          ...item,
          visitOrder: idx + 1,
        }),
      );

      setItems(reorderedItems);
    }
  };

  const handleDeleteItem = (index) => {
    const updated = items
      .filter((_, idx) => idx !== index)
      .map((item, idx) => ({
        ...item,
        visitOrder: idx + 1,
      }));
    setItems(updated);
  };

  return (
    <div
      style={{
        padding: "16px",
        backgroundColor: "#f9fafb",
        borderRadius: "12px",
        height: "100%",
      }}
    >
      <h3
        style={{
          fontSize: "16px",
          fontWeight: "bold",
          marginBottom: "12px",
          color: "#111827",
        }}
      >
        방문 동선 목록 ({items.length})
      </h3>

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
            items={items.map((_, idx) => `item-${idx}`)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item, index) => (
              <SortableItem
                key={`item-${index}`}
                id={`item-${index}`}
                item={item}
                index={index}
                onDelete={handleDeleteItem}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export default RoutePlanner;
