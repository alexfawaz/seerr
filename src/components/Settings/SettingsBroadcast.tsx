import Button from '@app/components/Common/Button';
import type { UserResultsResponse } from '@server/interfaces/api/userInterfaces';
import defineMessages from '@app/utils/defineMessages';
import { MegaphoneIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import Select from 'react-select';
import type { MultiValue } from 'react-select';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages('components.Settings.SettingsBroadcast', {
  broadcast: 'Broadcast',
  broadcastDescription:
    'Send a push notification to all subscribed users, or select specific users.',
  notificationTitle: 'Notification Title',
  message: 'Message',
  url: 'URL (optional)',
  urlPlaceholder: 'e.g., /movie/12345',
  sendBroadcast: 'Send Broadcast',
  sending: 'Sending…',
  sendToAllUsers: 'Send to All Users',
  selectUsers: 'Select Users',
  selectUsersPlaceholder: 'Search for users…',
  broadcastSuccess:
    'Broadcast sent to {sent} {sent, plural, one {user} other {users}} ({failed} failed)',
  broadcastError: 'Failed to send broadcast.',
  rateLimited: 'Please wait at least 60 seconds between broadcasts.',
  preview: 'Preview',
  previewTitle: 'Notification Title',
  previewBody: 'Your message will appear here',
  validationTitleRequired: 'Title is required',
  validationTitleMax: 'Title must be 50 characters or fewer',
  validationBodyRequired: 'Message is required',
  validationBodyMax: 'Message must be 120 characters or fewer',
  quickTemplates: 'Quick Templates',
});

const TEMPLATES = [
  {
    label: 'Maintenance',
    title: 'Scheduled Maintenance',
    body: "The Media Server will be briefly offline for maintenance. We'll be back shortly.",
  },
  {
    label: 'Back Online',
    title: "We're Back Online",
    body: 'The Media Server is back up and running. Thanks for your patience!',
  },
  {
    label: 'New Content',
    title: 'New Content Added',
    body: 'Fresh movies and TV shows have been added to the library. Go explore!',
  },
  {
    label: 'Requests',
    title: 'Requests Updated',
    body: 'Log in to check the latest status on your pending media requests.',
  },
  {
    label: 'Reminder',
    title: 'Reminder',
    body: "Don't forget to submit your media requests for the week!",
  },
];

type UserOption = {
  value: number;
  label: string;
};

const SettingsBroadcast = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<MultiValue<UserOption>>([]);
  const [result, setResult] = useState<{
    sent: number;
    failed: number;
  } | null>(null);

  const { data: userData } = useSWR<UserResultsResponse>(
    '/api/v1/user?take=100&sort=displayname'
  );

  const userOptions: UserOption[] =
    userData?.results?.map((user) => ({
      value: user.id,
      label: user.displayName,
    })) ?? [];

  const BroadcastSchema = Yup.object().shape({
    title: Yup.string()
      .required(intl.formatMessage(messages.validationTitleRequired))
      .max(50, intl.formatMessage(messages.validationTitleMax)),
    body: Yup.string()
      .required(intl.formatMessage(messages.validationBodyRequired))
      .max(120, intl.formatMessage(messages.validationBodyMax)),
    url: Yup.string(),
  });

  return (
    <>
      <div className="mb-6">
        <h3 className="heading">
          {intl.formatMessage(messages.broadcast)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.broadcastDescription)}
        </p>
      </div>
      <Formik
        initialValues={{
          title: '',
          body: '',
          url: '',
        }}
        validationSchema={BroadcastSchema}
        onSubmit={async (values, { setSubmitting, resetForm }) => {
          try {
            const payload: {
              title: string;
              body: string;
              url?: string;
              userIds?: number[];
            } = {
              title: values.title,
              body: values.body,
            };

            if (values.url) {
              payload.url = values.url;
            }

            if (!sendToAll && selectedUsers.length > 0) {
              payload.userIds = selectedUsers.map((u) => u.value);
            }

            const response = await axios.post(
              '/api/v1/settings/broadcast',
              payload
            );

            setResult(response.data);

            addToast(
              intl.formatMessage(messages.broadcastSuccess, {
                sent: response.data.sent,
                failed: response.data.failed,
              }),
              {
                appearance: 'success',
                autoDismiss: true,
              }
            );

            resetForm();
            setSelectedUsers([]);
          } catch (e) {
            if (
              axios.isAxiosError(e) &&
              e.response?.status === 429
            ) {
              addToast(intl.formatMessage(messages.rateLimited), {
                appearance: 'warning',
                autoDismiss: true,
              });
            } else {
              addToast(intl.formatMessage(messages.broadcastError), {
                appearance: 'error',
                autoDismiss: true,
              });
            }
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ errors, touched, isSubmitting, values, setValues }) => (
          <Form className="section">
            <div className="form-row">
              <label className="text-label">
                {intl.formatMessage(messages.quickTemplates)}
              </label>
              <div className="form-input-area">
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() =>
                        setValues({ title: tpl.title, body: tpl.body, url: '' })
                      }
                      className="rounded-full bg-gray-700 px-3 py-1 text-xs font-medium text-gray-200 transition hover:bg-indigo-600 hover:text-white"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="title" className="text-label">
                {intl.formatMessage(messages.notificationTitle)}
                <span className="label-required">*</span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="title"
                    name="title"
                    type="text"
                    maxLength={50}
                  />
                </div>
                <div
                  className={`mt-1 text-xs ${
                    values.title.length >= 50
                      ? 'text-red-500'
                      : 'text-gray-500'
                  }`}
                >
                  {values.title.length}/50
                </div>
                {errors.title &&
                  touched.title &&
                  typeof errors.title === 'string' && (
                    <div className="error">{errors.title}</div>
                  )}
              </div>
            </div>

            <div className="form-row">
              <label htmlFor="body" className="text-label">
                {intl.formatMessage(messages.message)}
                <span className="label-required">*</span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    as="textarea"
                    id="body"
                    name="body"
                    rows={3}
                    maxLength={120}
                  />
                </div>
                <div
                  className={`mt-1 text-xs ${
                    values.body.length >= 120
                      ? 'text-red-500'
                      : 'text-gray-500'
                  }`}
                >
                  {values.body.length}/120
                </div>
                {errors.body &&
                  touched.body &&
                  typeof errors.body === 'string' && (
                    <div className="error">{errors.body}</div>
                  )}
              </div>
            </div>

            <div className="form-row">
              <label htmlFor="url" className="text-label">
                {intl.formatMessage(messages.url)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="url"
                    name="url"
                    type="text"
                    placeholder={intl.formatMessage(messages.urlPlaceholder)}
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <label className="text-label">
                {intl.formatMessage(
                  sendToAll ? messages.sendToAllUsers : messages.selectUsers
                )}
              </label>
              <div className="form-input-area">
                <div className="mb-2 flex items-center">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={sendToAll}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      sendToAll ? 'bg-indigo-600' : 'bg-gray-600'
                    }`}
                    onClick={() => setSendToAll(!sendToAll)}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        sendToAll ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="ml-3 text-sm text-gray-400">
                    {intl.formatMessage(messages.sendToAllUsers)}
                  </span>
                </div>
                {!sendToAll && (
                  <Select<UserOption, true>
                    isMulti
                    options={userOptions}
                    value={selectedUsers}
                    onChange={(selected) => setSelectedUsers(selected)}
                    placeholder={intl.formatMessage(
                      messages.selectUsersPlaceholder
                    )}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    noOptionsMessage={() => 'No users found'}
                  />
                )}
              </div>
            </div>

            {/* Live Preview */}
            <div className="form-row">
              <label className="text-label">
                {intl.formatMessage(messages.preview)}
              </label>
              <div className="form-input-area">
                <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
                  <div className="flex items-start gap-3 p-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600">
                      <MegaphoneIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {values.title ||
                          intl.formatMessage(messages.previewTitle)}
                      </p>
                      <p className="mt-1 text-sm text-gray-300">
                        {values.body ||
                          intl.formatMessage(messages.previewBody)}
                      </p>
                      {values.url && (
                        <p className="mt-1 truncate text-xs text-indigo-400">
                          {values.url}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {result && (
              <div className="form-row">
                <div className="form-input-area ml-auto">
                  <div className="rounded-md bg-gray-800 p-3 text-sm text-gray-300">
                    {intl.formatMessage(messages.broadcastSuccess, {
                      sent: result.sent,
                      failed: result.failed,
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="actions">
              <div className="flex justify-end">
                <span className="ml-3 inline-flex rounded-md shadow-sm">
                  <Button
                    buttonType="primary"
                    type="submit"
                    disabled={
                      isSubmitting ||
                      (!sendToAll && selectedUsers.length === 0)
                    }
                  >
                    <MegaphoneIcon />
                    <span>
                      {isSubmitting
                        ? intl.formatMessage(messages.sending)
                        : intl.formatMessage(messages.sendBroadcast)}
                    </span>
                  </Button>
                </span>
              </div>
            </div>
          </Form>
        )}
      </Formik>
    </>
  );
};

export default SettingsBroadcast;
