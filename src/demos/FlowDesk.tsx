import { useMemo, useState, type FormEvent } from 'react';
import {
  Plus,
  MagnifyingGlass,
  SquaresFour,
  Users,
  ChatCircle,
  ArrowsSplit,
  CalendarBlank,
  Trash,
  ArrowUpRight,
} from '@phosphor-icons/react';
import type { Client, Ticket, TicketStatus, Priority } from '../../shared/types';
import { useDemo, type DemoController } from '../lib/api';
import { DemoBanner, ErrorNotice, LoadingState, Modal, dateTime, money } from './Common';

const statuses: { value: TicketStatus; label: string }[] = [
  { value: 'new', label: 'Новые' },
  { value: 'progress', label: 'В работе' },
  { value: 'waiting', label: 'Ожидание' },
  { value: 'done', label: 'Готово' },
];
const priorities: Record<Priority, string> = { low: 'Низкий', normal: 'Обычный', high: 'Высокий' };

export default function FlowDesk() {
  const demo = useDemo();
  const [tab, setTab] = useState<'tickets' | 'clients'>('tickets');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('all');
  const [manager, setManager] = useState('all');
  const [ticketModal, setTicketModal] = useState<string | null>(null);
  const [clientModal, setClientModal] = useState<string | null>(null);
  const state = demo.state;
  const filteredTickets = useMemo(
    () =>
      state?.flowdesk.tickets.filter((ticket) => {
        const client = state.flowdesk.clients.find((item) => item.id === ticket.clientId);
        const text =
          `${ticket.title} ${ticket.description} ${ticket.number} ${client?.name} ${client?.company}`.toLocaleLowerCase(
            'ru',
          );
        return (
          text.includes(search.toLocaleLowerCase('ru').trim()) &&
          (priority === 'all' || ticket.priority === priority) &&
          (manager === 'all' || ticket.managerId === manager)
        );
      }) || [],
    [state, search, priority, manager],
  );
  const clients =
    state?.flowdesk.clients.filter((client) =>
      `${client.name} ${client.company} ${client.email} ${client.phone}`
        .toLocaleLowerCase('ru')
        .includes(search.toLocaleLowerCase('ru').trim()),
    ) || [];
  const openTickets = state?.flowdesk.tickets.filter((ticket) => ticket.status !== 'done') || [];
  const selectedTicket = state?.flowdesk.tickets.find((ticket) => ticket.id === ticketModal);
  const selectedClient = state?.flowdesk.clients.find((client) => client.id === clientModal);
  function changeTab(next: 'tickets' | 'clients') {
    setTab(next);
    setSearch('');
  }
  function openTicket(id: string) {
    demo.clearError();
    setTicketModal(id);
  }
  function openClient(id: string) {
    demo.clearError();
    setClientModal(id);
  }

  return (
    <div className="demo flowdesk">
      <DemoBanner demo={demo} slug="flowdesk" />
      {!state ? (
        <LoadingState demo={demo} />
      ) : (
        <div className="flow-shell">
          <aside className="flow-sidebar">
            <div className="flow-brand">
              <span className="flow-brand-mark">
                <ArrowsSplit size={20} weight="bold" />
              </span>
              FlowDesk
            </div>
            <div className="flow-workspace">
              <span>М</span>
              <div>
                <strong>Мастерская</strong>
                <small>Сервисная компания</small>
              </div>
            </div>
            <nav className="flow-nav" aria-label="Разделы FlowDesk">
              <button
                className={tab === 'tickets' ? 'active' : ''}
                aria-current={tab === 'tickets' ? 'page' : undefined}
                onClick={() => changeTab('tickets')}
              >
                <SquaresFour size={17} /> Заявки <span>{state.flowdesk.tickets.length}</span>
              </button>
              <button
                className={tab === 'clients' ? 'active' : ''}
                aria-current={tab === 'clients' ? 'page' : undefined}
                onClick={() => changeTab('clients')}
              >
                <Users size={17} /> Клиенты <span>{state.flowdesk.clients.length}</span>
              </button>
            </nav>
            <div className="flow-sidebar-foot">
              <p>
                Вся работа.
                <br />В понятном порядке.
              </p>
              <div className="flow-user">
                <span className="flow-avatar">ДМ</span>
                <div>
                  <strong>Демо-команда</strong>
                  <p>{state.session.role === 'admin' ? 'Администратор' : 'Менеджер'}</p>
                </div>
              </div>
              <p>Роли можно переключать. Удаление заявок доступно администратору.</p>
            </div>
          </aside>
          <main className="flow-main" id="main">
            <div className="flow-topline">
              <div className="flow-breadcrumb">
                Рабочее пространство / {tab === 'tickets' ? 'Заявки' : 'Клиенты'}
              </div>
              <span className="flow-date">
                <CalendarBlank size={14} />
                {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </span>
            </div>
            <ErrorNotice error={demo.error} />
            <div className="flow-heading">
              <div>
                <h1>{tab === 'tickets' ? 'Заявки' : 'Клиенты'}</h1>
                <p>
                  {tab === 'tickets'
                    ? 'От первого обращения до выполненной работы.'
                    : 'Контакты, компании и история обращений.'}
                </p>
              </div>
              <button
                className="demo-btn"
                onClick={() => (tab === 'tickets' ? openTicket('new') : openClient('new'))}
              >
                <Plus size={16} />
                {tab === 'tickets' ? 'Новая заявка' : 'Добавить клиента'}
              </button>
            </div>
            {tab === 'tickets' && (
              <div className="flow-stats">
                <div className="flow-stat">
                  <span>Открытые заявки</span>
                  <strong>{openTickets.length}</strong>
                  <small>всего в работе</small>
                </div>
                <div className="flow-stat">
                  <span>Объем открытых заявок</span>
                  <strong>
                    {money(openTickets.reduce((sum, ticket) => sum + ticket.amount, 0))}
                  </strong>
                </div>
                <div className="flow-stat">
                  <span>Завершено</span>
                  <strong>
                    {state.flowdesk.tickets.filter((ticket) => ticket.status === 'done').length}
                  </strong>
                  <small>в этой демосессии</small>
                </div>
              </div>
            )}
            <div className="flow-toolbar">
              <label className="demo-search">
                <MagnifyingGlass size={17} />
                <span className="sr-only">
                  {tab === 'tickets' ? 'Поиск заявок' : 'Поиск клиентов'}
                </span>
                <input
                  placeholder={
                    tab === 'tickets' ? 'Найти заявку или клиента' : 'Имя, компания или контакт'
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {tab === 'tickets' && (
                <div className="flow-toolbar-filters">
                  <label>
                    <span className="sr-only">Фильтр по приоритету</span>
                    <select
                      className="demo-select"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="all">Все приоритеты</option>
                      {Object.entries(priorities).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Фильтр по менеджеру</span>
                    <select
                      className="demo-select"
                      value={manager}
                      onChange={(e) => setManager(e.target.value)}
                    >
                      <option value="all">Все менеджеры</option>
                      {state.flowdesk.managers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
            {tab === 'tickets' ? (
              <>
                {!filteredTickets.length && (
                  <div className="demo-empty">
                    <h3>Заявки не найдены</h3>
                    <p>Измените запрос или фильтры. Можно создать новую заявку.</p>
                  </div>
                )}
                <div className="flow-board" aria-label="Канбан заявок">
                  {statuses.map((status) => (
                    <section
                      key={status.value}
                      className={`flow-column flow-column-${status.value}`}
                      aria-label={status.label}
                    >
                      <header className="flow-column-header">
                        <span className="flow-column-label">
                          <i className="flow-status-dot" />
                          {status.label}
                        </span>
                        <span className="count">
                          {
                            filteredTickets.filter((ticket) => ticket.status === status.value)
                              .length
                          }
                        </span>
                      </header>
                      {filteredTickets
                        .filter((ticket) => ticket.status === status.value)
                        .map((ticket) => {
                          const client = state.flowdesk.clients.find(
                            (item) => item.id === ticket.clientId,
                          );
                          const assignee = state.flowdesk.managers.find(
                            (item) => item.id === ticket.managerId,
                          );
                          return (
                            <article className="flow-ticket" key={ticket.id}>
                              <div className="flow-ticket-top">
                                <span className="mono">FD-{ticket.number}</span>
                                <span className={`flow-priority ${ticket.priority}`}>
                                  {priorities[ticket.priority]}
                                </span>
                              </div>
                              <button
                                className="flow-ticket-title"
                                onClick={() => openTicket(ticket.id)}
                              >
                                {ticket.title}
                              </button>
                              <p className="flow-ticket-company">
                                {client?.company || client?.name}
                              </p>
                              <div className="flow-ticket-foot">
                                <strong>{money(ticket.amount)}</strong>
                                <span>
                                  <ChatCircle size={12} />
                                  {ticket.comments.length}
                                  <span className="flow-avatar" title={assignee?.name}>
                                    {assignee?.initials || '?'}
                                  </span>
                                </span>
                              </div>
                              <label>
                                <span className="sr-only">Статус заявки FD-{ticket.number}</span>
                                <select
                                  className="flow-ticket-select"
                                  value={ticket.status}
                                  disabled={demo.busy}
                                  onChange={(e) =>
                                    void demo.mutate(
                                      `/api/flowdesk/tickets/${ticket.id}/update`,
                                      { status: e.target.value },
                                      'Статус заявки сохранен.',
                                    )
                                  }
                                >
                                  {statuses.map((item) => (
                                    <option key={item.value} value={item.value}>
                                      {item.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </article>
                          );
                        })}
                      {!filteredTickets.some((ticket) => ticket.status === status.value) && (
                        <div className="flow-column-empty">Пока нет заявок</div>
                      )}
                    </section>
                  ))}
                </div>
                <p className="demo-small muted">
                  Откройте заявку, чтобы обсудить детали. Для перемещения используйте список
                  статусов на карточке.
                </p>
              </>
            ) : (
              <>
                {clients.length ? (
                  <div className="flow-client-grid">
                    {clients.map((client) => (
                      <article className="flow-client" key={client.id}>
                        <span className="flow-avatar">
                          {client.name
                            .split(' ')
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <h3>{client.name}</h3>
                        <p>{client.company}</p>
                        <a href={`mailto:${client.email}`}>{client.email}</a>
                        <a href={`tel:${client.phone.replace(/[^+\d]/g, '')}`}>{client.phone}</a>
                        <div className="flow-client-bottom">
                          <span>
                            {
                              state.flowdesk.tickets.filter(
                                (ticket) => ticket.clientId === client.id,
                              ).length
                            }{' '}
                            заявок
                          </span>
                          <button onClick={() => openClient(client.id)}>
                            Изменить <ArrowUpRight size={12} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="demo-empty">
                    <h3>Клиенты не найдены</h3>
                    <p>Попробуйте другой запрос или добавьте первого клиента.</p>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}
      {state && ticketModal === 'new' && (
        <Modal title="Новая заявка" onClose={() => setTicketModal(null)} error={demo.error}>
          <TicketForm demo={demo} onSaved={() => setTicketModal(null)} />
        </Modal>
      )}
      {state && selectedTicket && (
        <Modal
          title={`Заявка FD-${selectedTicket.number}`}
          onClose={() => setTicketModal(null)}
          error={demo.error}
        >
          <TicketForm
            key={selectedTicket.id}
            demo={demo}
            ticket={selectedTicket}
            onSaved={() => setTicketModal(null)}
          />
          <TicketComments demo={demo} ticket={selectedTicket} />
          {state.session.role === 'admin' && (
            <>
              <div className="demo-divider" />
              <button
                className="demo-btn danger"
                disabled={demo.busy}
                onClick={async () => {
                  if (window.confirm('Удалить эту заявку вместе с комментариями?')) {
                    if (
                      await demo.mutate(
                        `/api/flowdesk/tickets/${selectedTicket.id}/delete`,
                        {},
                        'Заявка удалена.',
                      )
                    )
                      setTicketModal(null);
                  }
                }}
              >
                <Trash size={15} />
                Удалить заявку
              </button>
            </>
          )}
        </Modal>
      )}
      {state && clientModal && (clientModal === 'new' || selectedClient) && (
        <Modal
          title={selectedClient ? 'Изменить клиента' : 'Новый клиент'}
          onClose={() => setClientModal(null)}
          error={demo.error}
        >
          <ClientForm
            key={clientModal}
            demo={demo}
            client={selectedClient}
            onSaved={() => setClientModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function TicketForm({
  demo,
  ticket,
  onSaved,
}: {
  demo: DemoController;
  ticket?: Ticket;
  onSaved: () => void;
}) {
  const state = demo.state!;
  const [title, setTitle] = useState(ticket?.title || '');
  const [description, setDescription] = useState(ticket?.description || '');
  const [clientId, setClientId] = useState(ticket?.clientId || state.flowdesk.clients[0]?.id || '');
  const [status, setStatus] = useState<TicketStatus>(ticket?.status || 'new');
  const [priority, setPriority] = useState<Priority>(ticket?.priority || 'normal');
  const [managerId, setManagerId] = useState(
    ticket?.managerId || state.flowdesk.managers[0]?.id || '',
  );
  const [amount, setAmount] = useState(String(ticket?.amount || ''));
  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = {
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      managerId,
      amount: Number(amount),
      ...(ticket ? {} : { clientId }),
    };
    if (
      await demo.mutate(
        ticket ? `/api/flowdesk/tickets/${ticket.id}/update` : '/api/flowdesk/tickets',
        body,
        ticket ? 'Изменения заявки сохранены.' : 'Заявка создана.',
      )
    )
      onSaved();
  }
  return (
    <form className="demo-form" onSubmit={submit}>
      <label className="demo-field">
        Название заявки
        <input
          required
          minLength={3}
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например, обслуживание кондиционеров"
          autoFocus
        />
      </label>
      <label className="demo-field">
        Клиент
        <select
          required
          disabled={!!ticket}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          {state.flowdesk.clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.company} - {client.name}
            </option>
          ))}
        </select>
      </label>
      <label className="demo-field">
        Описание
        <textarea
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Задача, адрес и важные детали"
        />
      </label>
      <div className="demo-form-row">
        <label className="demo-field">
          Статус
          <select
            aria-label="Статус"
            value={status}
            onChange={(e) => setStatus(e.target.value as TicketStatus)}
          >
            {statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="demo-field">
          Приоритет
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {Object.entries(priorities).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="demo-form-row">
        <label className="demo-field">
          Ответственный
          <select required value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            {state.flowdesk.managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
          </select>
        </label>
        <label className="demo-field">
          Стоимость, ₽
          <input
            required
            type="number"
            min="0"
            max="10000000"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </label>
      </div>
      <div className="demo-form-actions">
        <button className="demo-btn" disabled={demo.busy || !clientId}>
          {demo.busy ? 'Сохраняем...' : ticket ? 'Сохранить изменения' : 'Создать заявку'}
        </button>
      </div>
    </form>
  );
}

function TicketComments({ demo, ticket }: { demo: DemoController; ticket: Ticket }) {
  const [text, setText] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      await demo.mutate(
        `/api/flowdesk/tickets/${ticket.id}/comments`,
        { text: text.trim() },
        'Комментарий добавлен.',
      )
    )
      setText('');
  }
  return (
    <>
      <div className="demo-divider" />
      <h3>
        Обсуждение <span className="muted">({ticket.comments.length})</span>
      </h3>
      <div className="flow-comments">
        {ticket.comments.length ? (
          ticket.comments.map((comment) => (
            <div className="flow-comment" key={comment.id}>
              <span className="flow-avatar">
                {comment.author
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <div className="flow-comment-body">
                <strong>{comment.author}</strong>
                <time dateTime={comment.createdAt}>{dateTime(comment.createdAt)}</time>
                <p>{comment.text}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="muted demo-small">
            Пока без комментариев. Здесь можно сохранить договоренности по заявке.
          </p>
        )}
      </div>
      <form className="demo-form" onSubmit={submit}>
        <label className="demo-field">
          Комментарий
          <textarea
            required
            minLength={1}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Добавить детали для команды"
          />
        </label>
        <div className="demo-form-actions">
          <button className="demo-btn secondary" disabled={demo.busy || !text.trim()}>
            Отправить
          </button>
        </div>
      </form>
    </>
  );
}

function ClientForm({
  demo,
  client,
  onSaved,
}: {
  demo: DemoController;
  client?: Client;
  onSaved: () => void;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const body = Object.fromEntries(
      ['name', 'company', 'email', 'phone'].map((key) => [key, String(data.get(key) || '').trim()]),
    );
    if (
      await demo.mutate(
        client ? `/api/flowdesk/clients/${client.id}/update` : '/api/flowdesk/clients',
        body,
        client ? 'Контакты клиента сохранены.' : 'Клиент добавлен.',
      )
    )
      onSaved();
  }
  return (
    <form className="demo-form" onSubmit={submit}>
      <label className="demo-field">
        Имя клиента
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={client?.name}
          autoFocus
        />
      </label>
      <label className="demo-field">
        Компания
        <input
          name="company"
          required
          minLength={2}
          maxLength={100}
          defaultValue={client?.company}
        />
      </label>
      <label className="demo-field">
        Email
        <input name="email" type="email" required maxLength={150} defaultValue={client?.email} />
      </label>
      <label className="demo-field">
        Телефон клиента
        <input
          name="phone"
          type="tel"
          required
          minLength={5}
          maxLength={30}
          defaultValue={client?.phone}
          placeholder="+7 900 123-45-67"
        />
      </label>
      <div className="demo-form-actions">
        <button className="demo-btn" disabled={demo.busy}>
          {client ? 'Сохранить клиента' : 'Добавить клиента'}
        </button>
      </div>
    </form>
  );
}
